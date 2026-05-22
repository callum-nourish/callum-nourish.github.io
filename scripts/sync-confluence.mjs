#!/usr/bin/env node
/**
 * sync-confluence.mjs — fetch all Confluence spaces at build time.
 *
 * Directory structure mirrors the Confluence page hierarchy:
 *   content/confluence/{space-key}/{parent-slug}/{child-slug}/index.md
 *
 * Writes a sync-status index to content/confluence/index.md
 * Removes files/dirs for pages deleted or moved in Confluence.
 * Idempotent — safe to run multiple times.
 *
 * Required env vars:
 *   CONFLUENCE_API_TOKEN  — Atlassian personal access token
 *   CONFLUENCE_EMAIL      — account email for Basic auth
 *
 * Optional env vars:
 *   CONFLUENCE_CLOUD_ID       — defaults to hardcoded nourish cloud ID
 *   CONFLUENCE_SPACE_KEYS     — comma-separated keys to sync (default: all global spaces)
 *   CONFLUENCE_EXCLUDE_SPACES — comma-separated keys to always skip
 *                               (defaults to personal / utility spaces)
 */

import { readdir, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONTENT_ROOT = join(__dirname, '..', 'content', 'confluence')
const ATLASSIAN_BASE = 'https://nourishcare.atlassian.net'

// ── Config ────────────────────────────────────────────────────────────────────

const CLOUD_ID = process.env.CONFLUENCE_CLOUD_ID ?? '26a5fb48-bb0c-45aa-98fe-72e065c0e7dc'
const EMAIL = process.env.CONFLUENCE_EMAIL
const TOKEN = process.env.CONFLUENCE_API_TOKEN

if (!EMAIL || !TOKEN) {
  console.error('Error: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN must be set.')
  process.exit(1)
}

// Specific space keys to sync (comma-separated). If unset → all global spaces.
const ONLY_KEYS = process.env.CONFLUENCE_SPACE_KEYS
  ? new Set(process.env.CONFLUENCE_SPACE_KEYS.split(',').map((s) => s.trim().toUpperCase()))
  : null

// Personal/utility spaces excluded by default. Override with CONFLUENCE_EXCLUDE_SPACES.
const DEFAULT_EXCLUDE = new Set([
  'VV',           // Valentina Vivian — personal space (PII)
  'PO',           // Pieter Oliver — personal space (PII)
  'DRAWIOCONFIG', // draw.io plugin config files — not docs
  'TOFF',         // Time Off — HR/personal
  'JDFS',         // Jakes Dummy finance space — financial/test data
])
const EXCLUDE_KEYS = process.env.CONFLUENCE_EXCLUDE_SPACES
  ? new Set(process.env.CONFLUENCE_EXCLUDE_SPACES.split(',').map((s) => s.trim().toUpperCase()))
  : DEFAULT_EXCLUDE

// How many spaces to sync in parallel. Each space fetches pages sequentially
// at ~80 ms/page, so 5 concurrent spaces ≈ 60 req/s total — well within
// Atlassian Cloud limits. Lower if you see 429 errors.
const CONCURRENCY = parseInt(process.env.CONFLUENCE_CONCURRENCY ?? '5', 10)

const BASE_URL = `https://api.atlassian.com/ex/confluence/${CLOUD_ID}/wiki/api/v2`
const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')

// ── API client ────────────────────────────────────────────────────────────────

async function cfetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${AUTH}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} @ ${path}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Worker-pool concurrent mapper. Runs up to `concurrency` async tasks at once.
// Safe in JS because i++ is atomic on the single-threaded event loop.
async function pMap(items, fn, concurrency) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function pageUrl(spaceKey, pageId) {
  return `${ATLASSIAN_BASE}/wiki/spaces/${spaceKey}/pages/${pageId}`
}

// ── Space listing ─────────────────────────────────────────────────────────────

async function fetchAllSpaces() {
  const spaces = []
  let cursor = null
  do {
    const params = { limit: 50, type: 'global', status: 'current' }
    if (cursor) params.cursor = cursor
    const data = await cfetch('/spaces', params)
    spaces.push(...(data.results ?? []))
    const next = data._links?.next
    cursor = next ? new URL(next, 'https://x').searchParams.get('cursor') : null
  } while (cursor)
  return spaces
}

// ── Page listing ──────────────────────────────────────────────────────────────

async function fetchAllPages(spaceId) {
  const pages = []
  let cursor = null
  do {
    const params = { limit: 50, status: 'current' }
    if (cursor) params.cursor = cursor
    const data = await cfetch(`/spaces/${spaceId}/pages`, params)
    pages.push(...(data.results ?? []))
    const next = data._links?.next
    cursor = next ? new URL(next, 'https://x').searchParams.get('cursor') : null
  } while (cursor)
  return pages
}

// ── Page body ─────────────────────────────────────────────────────────────────

async function fetchPageBody(pageId) {
  const data = await cfetch(`/pages/${pageId}`, { 'body-format': 'atlas_doc_format' })
  const adfRaw = data.body?.atlas_doc_format?.value
  let adf = null
  if (adfRaw) {
    try { adf = typeof adfRaw === 'string' ? JSON.parse(adfRaw) : adfRaw } catch { /* skip */ }
  }
  return {
    title: data.title ?? '',
    adf,
    lastModified: data.version?.createdAt ?? data.createdAt ?? null,
    status: data.status ?? 'current',
  }
}

// ── Hierarchy: build a path map mirroring Confluence structure ─────────────────
//
// Each page is written as {spaceDir}/{ancestor-slug}/{slug}/index.md so the
// filesystem tree matches what you see in the Confluence sidebar.

function slugify(title) {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    || 'untitled'
  )
}

/**
 * Build a Map<pageId, relativePath> where relativePath uses the full ancestor
 * chain, e.g. "product/discovery/user-research".
 * Sibling slug collisions get the page ID appended.
 */
function buildPathMap(pages) {
  const pageIds = new Set(pages.map((p) => String(p.id)))

  // Group children by parentId (only within the current space's page set)
  const children = new Map() // parentId → Page[]
  const roots = []

  for (const page of pages) {
    const pid = page.parentId ? String(page.parentId) : null
    if (pid && pageIds.has(pid)) {
      if (!children.has(pid)) children.set(pid, [])
      children.get(pid).push(page)
    } else {
      roots.push(page)
    }
  }

  const pathMap = new Map() // pageId → relative path string

  function assignPaths(siblings, prefix) {
    // Deduplicate slugs among siblings
    const baseSlugs = siblings.map((p) => slugify(p.title) || `page-${p.id}`)
    const counts = {}
    for (const s of baseSlugs) counts[s] = (counts[s] ?? 0) + 1

    siblings.forEach((page, i) => {
      const base = baseSlugs[i]
      const slug = counts[base] > 1 ? `${base}-${page.id}` : base
      const path = prefix ? `${prefix}/${slug}` : slug
      pathMap.set(String(page.id), path)

      const kids = children.get(String(page.id)) ?? []
      if (kids.length) assignPaths(kids, path)
    })
  }

  assignPaths(roots, '')
  return pathMap
}

// ── ADF → Markdown ────────────────────────────────────────────────────────────

function adfToMarkdown(node, ctx = { listDepth: 0 }) {
  if (!node) return ''

  switch (node.type) {
    case 'doc':
      return joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))

    case 'paragraph': {
      const text = inline(node.content, ctx)
      return text.trim() ? text + '\n' : ''
    }

    case 'heading': {
      const level = Math.min(node.attrs?.level ?? 1, 6)
      return '#'.repeat(level) + ' ' + inline(node.content, ctx).trim() + '\n'
    }

    case 'text': {
      let t = node.text ?? ''
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'strong': t = `**${t}**`; break
          case 'em':     t = `_${t}_`;   break
          case 'code':   t = `\`${t}\``; break
          case 'strike': t = `~~${t}~~`; break
          case 'link':   t = `[${t}](${mark.attrs?.href ?? ''})`; break
        }
      }
      return t
    }

    case 'hardBreak': return '\n'
    case 'rule':      return '\n---\n'

    case 'bulletList': {
      const pad = '  '.repeat(ctx.listDepth)
      return (node.content ?? []).map((item) =>
        adfToMarkdown(item, { ...ctx, listDepth: ctx.listDepth + 1, marker: `${pad}- ` }),
      ).join('') + '\n'
    }

    case 'orderedList': {
      const pad = '  '.repeat(ctx.listDepth)
      return (node.content ?? []).map((item, i) =>
        adfToMarkdown(item, { ...ctx, listDepth: ctx.listDepth + 1, marker: `${pad}${i + 1}. ` }),
      ).join('') + '\n'
    }

    case 'listItem': {
      const marker = ctx.marker ?? '- '
      const childCtx = { ...ctx, marker: undefined }
      const [first, ...rest] = node.content ?? []
      const firstLine = marker + adfToMarkdown(first ?? { type: 'paragraph', content: [] }, childCtx).trimStart()
      const restLines = rest.map((c) => {
        const rendered = adfToMarkdown(c, childCtx)
        const indent = ' '.repeat(marker.length)
        return rendered.split('\n').map((l) => (l.trim() ? indent + l : l)).join('\n')
      })
      return [firstLine, ...restLines].join('').trimEnd() + '\n'
    }

    case 'codeBlock': {
      const lang = node.attrs?.language ?? ''
      const code = (node.content ?? []).map((n) => n.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\`\n`
    }

    case 'blockquote': {
      const inner = joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))
      return inner.split('\n').map((l) => '> ' + l).join('\n').trimEnd() + '\n'
    }

    case 'table': {
      const rows = node.content ?? []
      if (!rows.length) return ''
      const rendered = rows.map((row) =>
        '| ' + (row.content ?? []).map((cell) =>
          (cell.content ?? []).map((n) => adfToMarkdown(n, ctx)).join('').replace(/\n+/g, ' ').trim() || ' '
        ).join(' | ') + ' |'
      )
      const cols = (rows[0]?.content ?? []).length || 1
      rendered.splice(1, 0, '| ' + Array(cols).fill('---').join(' | ') + ' |')
      return rendered.join('\n') + '\n'
    }

    case 'tableRow':    return (node.content ?? []).map((n) => adfToMarkdown(n, ctx)).join(' | ')
    case 'tableHeader':
    case 'tableCell':   return (node.content ?? []).map((n) => adfToMarkdown(n, ctx)).join('')

    case 'panel': {
      const label = node.attrs?.panelType ?? 'note'
      const inner = joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))
      return `> **${label.charAt(0).toUpperCase() + label.slice(1)}:** ${inner.trim()}\n`
    }

    case 'expand':
    case 'nestedExpand': {
      const title = node.attrs?.title ?? ''
      const inner = joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))
      return (title ? `**${title}**\n\n` : '') + inner
    }

    case 'inlineCard':
    case 'blockCard': {
      const url = node.attrs?.url ?? ''
      return url ? `[${url}](${url})` : ''
    }

    case 'date': {
      const ts = node.attrs?.timestamp
      if (!ts) return ''
      try { return new Date(parseInt(ts)).toISOString().slice(0, 10) } catch { return String(ts) }
    }

    case 'status':      return node.attrs?.text ?? ''
    case 'emoji':       return node.attrs?.shortName ?? node.attrs?.text ?? ''
    case 'mention':     return '' // PII — strip all colleague name mentions
    case 'media':
    case 'mediaSingle':
    case 'mediaGroup':
    case 'mediaInline': return '' // blob URLs / attachments — not externally accessible

    default:
      return node.content
        ? joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))
        : ''
  }
}

function inline(nodes, ctx) {
  return (nodes ?? []).map((n) => adfToMarkdown(n, ctx)).join('')
}

function joinBlocks(parts) {
  return parts.join('\n').replace(/\n{3,}/g, '\n\n')
}

function postProcess(md) {
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

// ── File building ─────────────────────────────────────────────────────────────

function buildPage(title, pageId, spaceKey, lastModified, mdBody) {
  const updated = lastModified?.slice(0, 10) ?? null
  const fm = [
    '---',
    `title: "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `tags:`,
    `  - confluence`,
    `  - ${spaceKey.toLowerCase()}`,
    `confluenceId: ${pageId}`,
    ...(updated ? [`updated: ${updated}`] : []),
    '---',
  ].join('\n')
  const footer = `\n\n---\n\n*[View in Confluence ↗](${pageUrl(spaceKey, pageId)})*\n`
  return fm + '\n\n' + mdBody + footer
}

function buildSpaceIndex(space, pageCount, syncedAt) {
  return [
    '---',
    `title: "${space.name.replace(/"/g, '\\"')}"`,
    'tags:',
    `  - confluence`,
    `  - ${space.key.toLowerCase()}`,
    '---',
    '',
    `> Last synced from Confluence: **${syncedAt}**`,
    '',
    `**${pageCount}** pages synced from the [${space.name}](${ATLASSIAN_BASE}/wiki/spaces/${space.key}) space.`,
    '',
  ].join('\n')
}

function buildRootIndex(syncedAt, spaceStats) {
  const rows = spaceStats
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `| [${s.name}](/confluence/${s.dirKey}) | \`${s.key}\` | ${s.count} |`)

  return [
    '---',
    'title: "Confluence"',
    'tags:',
    '  - confluence',
    '---',
    '',
    `> **Last synced:** ${syncedAt}`,
    '',
    '| Space | Key | Pages |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

// ── Stale file cleanup ────────────────────────────────────────────────────────
// Recursively removes .md files not in writtenPaths, then prunes empty dirs.

async function removeStale(dir, writtenPaths) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await removeStale(full, writtenPaths)
      // Prune the directory if it's now empty
      try {
        const remaining = await readdir(full)
        if (!remaining.length) await rm(full)
      } catch { /* ok */ }
    } else if (entry.isFile() && entry.name.endsWith('.md') && !writtenPaths.has(full)) {
      await rm(full)
    }
  }
}

// ── Sync issues log ───────────────────────────────────────────────────────────

function buildIssuesPage(syncedAt, issues) {
  if (!issues.length) {
    return [
      '---',
      'title: "Confluence Sync Issues"',
      'tags:',
      '  - confluence',
      '---',
      '',
      `> Last checked: **${syncedAt}**`,
      '',
      '✅ No issues on last sync.',
      '',
    ].join('\n')
  }

  const bySpace = {}
  for (const issue of issues) {
    if (!bySpace[issue.space]) bySpace[issue.space] = []
    bySpace[issue.space].push(issue)
  }

  const sections = Object.entries(bySpace).map(([space, items]) => {
    const rows = items.map(
      (i) => `| ${i.title} | ${i.pageId} | ${i.reason} |`,
    )
    return [
      `### ${space}`,
      '',
      '| Page title | Confluence ID | Reason |',
      '| --- | --- | --- |',
      ...rows,
      '',
    ].join('\n')
  })

  return [
    '---',
    'title: "Confluence Sync Issues"',
    'tags:',
    '  - confluence',
    '---',
    '',
    `> Last checked: **${syncedAt}** — **${issues.length}** issue${issues.length !== 1 ? 's' : ''} across **${Object.keys(bySpace).length}** space${Object.keys(bySpace).length !== 1 ? 's' : ''}`,
    '',
    ...sections,
  ].join('\n')
}

// ── Sync one space ────────────────────────────────────────────────────────────

async function syncSpace(space, syncedAt, issues) {
  const dirKey = slugify(space.key)
  const spaceDir = join(CONTENT_ROOT, dirKey)
  await mkdir(spaceDir, { recursive: true })

  // 1. Fetch flat page list (includes parentId)
  const pages = await fetchAllPages(space.id)

  // 2. Build hierarchy-aware path map
  const pathMap = buildPathMap(pages)

  // 3. Fetch bodies and write files
  const writtenPaths = new Set()
  // Always keep the space index
  writtenPaths.add(join(spaceDir, 'index.md'))

  let written = 0, unchanged = 0, errors = 0

  for (const page of pages) {
    const relPath = pathMap.get(String(page.id))
    if (relPath === undefined) continue // shouldn't happen

    // Each page is index.md inside its own slug directory
    const pageDir = join(spaceDir, relPath)
    const filePath = join(pageDir, 'index.md')
    writtenPaths.add(filePath)

    try {
      await sleep(80)
      const { title, adf, lastModified, status } = await fetchPageBody(page.id)

      if (status === 'archived') continue

      let mdBody = ''
      if (adf) {
        try {
          mdBody = postProcess(adfToMarkdown(adf))
        } catch (convErr) {
          issues.push({
            space: space.key,
            title: title || page.title || page.id,
            pageId: page.id,
            reason: `ADF conversion error: ${convErr.message}`,
          })
          mdBody = `> ⚠️ Content could not be converted. [View original in Confluence ↗](${pageUrl(space.key, page.id)})`
        }
      } else {
        issues.push({
          space: space.key,
          title: page.title || page.id,
          pageId: page.id,
          reason: 'No ADF body returned by API (unsupported page type or empty page)',
        })
      }

      const content = buildPage(title || page.title, page.id, space.key, lastModified, mdBody)

      await mkdir(pageDir, { recursive: true })

      let existing = null
      try { existing = await readFile(filePath, 'utf-8') } catch { /* new */ }

      if (existing === content) {
        unchanged++
      } else {
        await writeFile(filePath, content, 'utf-8')
        written++
      }
    } catch (err) {
      issues.push({
        space: space.key,
        title: page.title || page.id,
        pageId: page.id,
        reason: `Fetch failed: ${err.message}`,
      })
      errors++
    }
  }

  // 4. Remove stale files and empty directories
  await removeStale(spaceDir, writtenPaths)

  // 5. Write space index (always refresh — contains sync timestamp)
  await writeFile(
    join(spaceDir, 'index.md'),
    buildSpaceIndex(space, written + unchanged, syncedAt),
    'utf-8',
  )

  console.log(
    `  ${space.key.padEnd(16)} ${pages.length} pages — ` +
    `${written} written, ${unchanged} unchanged` +
    (errors ? `, ${errors} errors` : ''),
  )

  return { key: space.key, dirKey, name: space.name, count: written + unchanged, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(CONTENT_ROOT, { recursive: true })

  const syncedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  // Fetch space list
  process.stdout.write('Fetching space list... ')
  let spaces = await fetchAllSpaces()
  console.log(`${spaces.length} global spaces`)

  // Apply filters
  if (ONLY_KEYS) {
    spaces = spaces.filter((s) => ONLY_KEYS.has(s.key.toUpperCase()))
    console.log(`Filtering to: ${[...ONLY_KEYS].join(', ')} → ${spaces.length} spaces`)
  } else {
    const excluded = spaces.filter((s) => EXCLUDE_KEYS.has(s.key.toUpperCase()))
    spaces = spaces.filter((s) => !EXCLUDE_KEYS.has(s.key.toUpperCase()))
    if (excluded.length) console.log(`Excluded: ${excluded.map((s) => s.key).join(', ')}`)
  }

  console.log(`Syncing ${spaces.length} spaces (${CONCURRENCY} parallel):\n`)

  const issues = [] // shared across all spaces — JS is single-threaded, no races

  const rawResults = await pMap(spaces, async (space) => {
    try {
      return await syncSpace(space, syncedAt, issues)
    } catch (err) {
      console.error(`  ✗  ${space.key}: ${err.message}`)
      issues.push({ space: space.key, title: space.name, pageId: '—', reason: `Space sync failed: ${err.message}` })
      return null
    }
  }, CONCURRENCY)

  const stats = rawResults.filter(Boolean)
  const totalErrors = stats.reduce((n, s) => n + s.errors, 0) + rawResults.filter((r) => !r).length

  // Remove directories for spaces no longer in the sync set
  const syncedDirKeys = new Set(stats.map((s) => s.dirKey))
  for (const entry of await readdir(CONTENT_ROOT)) {
    if (entry === 'index.md') continue
    const full = join(CONTENT_ROOT, entry)
    try {
      const s = await stat(full)
      if (s.isDirectory() && !syncedDirKeys.has(entry)) {
        await rm(full, { recursive: true })
        console.log(`  🗑  removed stale space dir: ${entry}`)
      }
    } catch { /* ok */ }
  }

  // Write root index and issues log
  await writeFile(join(CONTENT_ROOT, 'index.md'), buildRootIndex(syncedAt, stats), 'utf-8')
  await writeFile(join(CONTENT_ROOT, '_sync-issues.md'), buildIssuesPage(syncedAt, issues), 'utf-8')

  const totalPages = stats.reduce((n, s) => n + s.count, 0)
  console.log(`\nDone: ${totalPages} pages across ${stats.length} spaces. Synced at ${syncedAt}.`)
  if (totalErrors > 0) {
    console.error(`${totalErrors} total errors.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

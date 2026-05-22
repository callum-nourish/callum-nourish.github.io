#!/usr/bin/env node
/**
 * build-confluence.mjs — convert cached Confluence ADF data → Markdown content.
 *
 * Reads from  .confluence-cache/  (written by sync-confluence.mjs)
 * Writes to   content/confluence/
 *
 * Run this independently to iterate on conversion logic without hitting the API:
 *   node scripts/build-confluence.mjs
 *
 * No env vars required. No network calls.
 */

import { readdir, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_ROOT = join(__dirname, '..', '.confluence-cache')
const CONTENT_ROOT = join(__dirname, '..', 'content', 'confluence')
const CARDS_ROOT = join(__dirname, '..', 'content')
const ATLASSIAN_BASE = 'https://nourishcare.atlassian.net'

// Populated in main() — slugs of out-*.md / bp-*.md card files that exist in content/
// Used to turn Jira smart links into wikilinks where the card page already exists.
const KNOWN_CARDS = new Set()

// ── Slugify ───────────────────────────────────────────────────────────────────

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

// ── Hierarchy ─────────────────────────────────────────────────────────────────
//
// Parent pages (have children) → {path}/index.md   Explorer folder
// Leaf pages   (no children)  → {path}.md          Explorer file

function buildPathMap(pages) {
  const pageIds = new Set(pages.map((p) => String(p.id)))
  const children = new Map()
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

  const pathMap = new Map()

  function assignPaths(siblings, prefix) {
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
  const parentIds = new Set(children.keys())
  return { pathMap, parentIds }
}

// ── ADF → Markdown ────────────────────────────────────────────────────────────

function adfToMarkdown(node, ctx = { listDepth: 0, mentions: new Set() }) {
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
      const panelType = node.attrs?.panelType ?? 'note'
      const inner = joinBlocks((node.content ?? []).map((n) => adfToMarkdown(n, ctx)))
      // Standard Confluence panel types get a meaningful label.
      // 'custom' panels are just formatted content — don't add a noisy "Custom:" prefix.
      const LABELLED = new Set(['note', 'tip', 'warning', 'error', 'info', 'success'])
      if (LABELLED.has(panelType)) {
        const label = panelType.charAt(0).toUpperCase() + panelType.slice(1)
        return `> **${label}:** ${inner.trim()}\n`
      }
      return inner.trim() + '\n'
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
      if (!url) return ''
      // Jira ticket URLs → [OUT-123](url), or [[out-123]] if the card exists locally
      const jiraMatch = url.match(/\/browse\/([A-Za-z]+-\d+)/)
      if (jiraMatch) {
        const ticketId = jiraMatch[1]                     // e.g. "OUT-123"
        const slug = ticketId.toLowerCase()               // e.g. "out-123"
        if (KNOWN_CARDS.has(slug)) return `[[${slug}]]`  // wikilink → graph edge
        return `[${ticketId}](${url})`                    // pretty label at minimum
      }
      return `[${url}](${url})`
    }

    case 'date': {
      const ts = node.attrs?.timestamp
      if (!ts) return ''
      try { return new Date(parseInt(ts)).toISOString().slice(0, 10) } catch { return String(ts) }
    }

    case 'status': return node.attrs?.text ?? ''
    case 'emoji':  return node.attrs?.text ?? node.attrs?.shortName ?? ''

    case 'mention': {
      // Keep the display name as plain text; collect a person/ tag for navigation.
      // The tag page at /tags/person/name lists every doc mentioning this person.
      const raw = (node.attrs?.text ?? '').replace(/^@/, '').trim()
      if (!raw) return ''
      const tag = 'person/' + raw.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
      ctx.mentions?.add(tag)
      return raw
    }

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
  // 1. Strip empty bullet / numbered list items (template placeholders like "- " with nothing)
  md = md.replace(/^[ \t]*[-*][ \t]*\n/gm, '')
  md = md.replace(/^[ \t]*\d+\.[ \t]*\n/gm, '')

  // 2. Remove headings whose only following content (before the next heading or EOF)
  //    is blank lines — i.e. empty sections left by stripping media/macros/bullets.
  md = removeEmptyHeadings(md)

  // 3. Collapse multiple consecutive horizontal rules into one
  md = md.replace(/(\n---\n)(\s*---\n)+/g, '\n---\n')

  // 4. Collapse 3+ blank lines → 2
  md = md.replace(/\n{3,}/g, '\n\n')

  return md.trim()
}

function removeEmptyHeadings(md) {
  const lines = md.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^#{1,6}\s+\S/.test(line)) {
      // Scan ahead past blank lines to find the next non-blank line
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      // If the next non-blank line is another heading or we hit EOF → empty section
      if (j >= lines.length || /^#{1,6}\s/.test(lines[j])) {
        i = j // skip this heading and the blanks after it
        continue
      }
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

// ── File builders ─────────────────────────────────────────────────────────────

function buildPage(title, pageId, spaceKey, lastModified, mdBody, mentions = []) {
  const updated = lastModified?.slice(0, 10) ?? null
  const allTags = ['confluence', spaceKey.toLowerCase(), ...mentions].map((t) => `  - ${t}`)
  const fm = [
    '---',
    `title: "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    'tags:',
    ...allTags,
    `confluenceId: ${pageId}`,
    ...(updated ? [`updated: ${updated}`] : []),
    '---',
  ].join('\n')
  const pageUrl = `${ATLASSIAN_BASE}/wiki/spaces/${spaceKey}/pages/${pageId}`
  return fm + '\n\n' + mdBody + `\n\n---\n\n*[View in Confluence ↗](${pageUrl})*\n`
}

function buildSpaceIndex(space, pageCount, syncedAt) {
  return [
    '---',
    `title: "${space.name.replace(/"/g, '\\"')}"`,
    'tags:',
    '  - confluence',
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
      '✅ No issues on last build.',
      '',
    ].join('\n')
  }

  const bySpace = {}
  for (const issue of issues) {
    if (!bySpace[issue.space]) bySpace[issue.space] = []
    bySpace[issue.space].push(issue)
  }

  const sections = Object.entries(bySpace).map(([space, items]) => [
    `### ${space}`,
    '',
    '| Page title | Confluence ID | Reason |',
    '| --- | --- | --- |',
    ...items.map((i) => `| ${i.title} | ${i.pageId} | ${i.reason} |`),
    '',
  ].join('\n'))

  return [
    '---',
    'title: "Confluence Sync Issues"',
    'tags:',
    '  - confluence',
    '---',
    '',
    `> Last checked: **${syncedAt}** — **${issues.length}** issue${issues.length !== 1 ? 's' : ''}`,
    '',
    ...sections,
  ].join('\n')
}

// ── Stale file cleanup ────────────────────────────────────────────────────────

async function removeStale(dir, writtenPaths) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await removeStale(full, writtenPaths)
      try {
        const remaining = await readdir(full)
        if (!remaining.length) await rm(full)
      } catch { /* ok */ }
    } else if (entry.isFile() && entry.name.endsWith('.md') && !writtenPaths.has(full)) {
      await rm(full)
    }
  }
}

// ── Build one space ───────────────────────────────────────────────────────────

async function buildSpace(spaceKey, spaceName, syncedAt, issues) {
  const cacheDir = join(CACHE_ROOT, spaceKey.toLowerCase())
  const dirKey = slugify(spaceKey)
  const spaceDir = join(CONTENT_ROOT, dirKey)
  await mkdir(spaceDir, { recursive: true })

  // Read page listing from cache
  let pages
  try {
    pages = JSON.parse(await readFile(join(cacheDir, 'pages.json'), 'utf-8'))
  } catch (err) {
    throw new Error(`Cannot read pages.json for ${spaceKey}: ${err.message}`)
  }

  const { pathMap, parentIds } = buildPathMap(pages)

  const writtenPaths = new Set()
  writtenPaths.add(join(spaceDir, 'index.md'))

  let written = 0, unchanged = 0, errors = 0

  for (const page of pages) {
    const relPath = pathMap.get(String(page.id))
    if (relPath === undefined) continue

    const isParent = parentIds.has(String(page.id))
    const filePath = isParent
      ? join(spaceDir, relPath, 'index.md')
      : join(spaceDir, relPath + '.md')
    writtenPaths.add(filePath)

    // Read ADF from cache
    let detail
    try {
      detail = JSON.parse(await readFile(join(cacheDir, `${page.id}.json`), 'utf-8'))
    } catch {
      issues.push({ space: spaceKey, title: page.title, pageId: page.id, reason: 'Missing from cache — re-run sync-confluence.mjs' })
      errors++
      continue
    }

    if (detail.status === 'archived') continue

    let mdBody = ''
    const mentionCtx = { listDepth: 0, mentions: new Set() }

    if (detail.adf) {
      try {
        mdBody = postProcess(adfToMarkdown(detail.adf, mentionCtx))
      } catch (convErr) {
        issues.push({ space: spaceKey, title: detail.title || page.title, pageId: page.id, reason: `ADF conversion error: ${convErr.message}` })
        mdBody = `> ⚠️ Content could not be converted. [View original in Confluence ↗](${ATLASSIAN_BASE}/wiki/spaces/${spaceKey}/pages/${page.id})`
      }
    } else {
      issues.push({ space: spaceKey, title: page.title, pageId: page.id, reason: 'No ADF body (empty page or unsupported type)' })
    }

    const content = buildPage(
      detail.title || page.title,
      page.id,
      spaceKey,
      detail.lastModified,
      mdBody,
      [...mentionCtx.mentions],
    )

    await mkdir(dirname(filePath), { recursive: true })

    let existing = null
    try { existing = await readFile(filePath, 'utf-8') } catch { /* new file */ }

    if (existing === content) {
      unchanged++
    } else {
      await writeFile(filePath, content, 'utf-8')
      written++
    }
  }

  await removeStale(spaceDir, writtenPaths)

  await writeFile(
    join(spaceDir, 'index.md'),
    buildSpaceIndex({ key: spaceKey, name: spaceName }, written + unchanged, syncedAt),
    'utf-8',
  )

  console.log(
    `  ${spaceKey.padEnd(16)} ${pages.length} pages — ` +
    `${written} written, ${unchanged} unchanged` +
    (errors ? `, ${errors} errors` : ''),
  )

  return { key: spaceKey, dirKey, name: spaceName, count: written + unchanged, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Read manifest written by sync-confluence.mjs
  let manifest
  try {
    manifest = JSON.parse(await readFile(join(CACHE_ROOT, 'manifest.json'), 'utf-8'))
  } catch {
    console.error('No cache found. Run sync-confluence.mjs first.')
    process.exit(1)
  }

  await mkdir(CONTENT_ROOT, { recursive: true })

  // Build set of card slugs (out-123, bp-456) so Jira smart links become wikilinks
  try {
    const cardFiles = await readdir(CARDS_ROOT)
    for (const f of cardFiles) {
      if (/^(out|bp)-\d+\.md$/i.test(f)) KNOWN_CARDS.add(f.replace(/\.md$/, '').toLowerCase())
    }
    if (KNOWN_CARDS.size) console.log(`${KNOWN_CARDS.size} card pages found for wikilink resolution`)
  } catch { /* content/ might not have cards yet */ }

  const syncedAt = new Date(manifest.syncedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  console.log(`Building from cache (synced ${syncedAt})`)
  console.log(`${manifest.spaces.length} spaces\n`)

  const issues = []
  const stats = []
  let totalErrors = 0

  for (const space of manifest.spaces) {
    try {
      const result = await buildSpace(space.key, space.name, syncedAt, issues)
      stats.push(result)
      totalErrors += result.errors
    } catch (err) {
      console.error(`  ✗  ${space.key}: ${err.message}`)
      issues.push({ space: space.key, title: space.name, pageId: '—', reason: err.message })
      totalErrors++
    }
  }

  // Remove directories for spaces no longer in the manifest
  const syncedDirKeys = new Set(stats.map((s) => s.dirKey))
  for (const entry of await readdir(CONTENT_ROOT)) {
    if (entry === 'index.md' || entry === '_sync-issues.md') continue
    const full = join(CONTENT_ROOT, entry)
    try {
      const s = await stat(full)
      if (s.isDirectory() && !syncedDirKeys.has(entry)) {
        await rm(full, { recursive: true })
        console.log(`  🗑  removed stale space dir: ${entry}`)
      }
    } catch { /* ok */ }
  }

  await writeFile(join(CONTENT_ROOT, 'index.md'), buildRootIndex(syncedAt, stats), 'utf-8')
  await writeFile(join(CONTENT_ROOT, '_sync-issues.md'), buildIssuesPage(syncedAt, issues), 'utf-8')

  const total = stats.reduce((n, s) => n + s.count, 0)
  console.log(`\nDone: ${total} pages across ${stats.length} spaces.`)
  if (totalErrors > 0) { console.error(`${totalErrors} errors.`); process.exit(1) }
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1) })

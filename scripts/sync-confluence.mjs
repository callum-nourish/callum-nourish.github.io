#!/usr/bin/env node
/**
 * sync-confluence.mjs — fetch raw page data from Confluence and cache it locally.
 *
 * Writes to .confluence-cache/{spaceKey}/
 *   pages.json        — page listing (id, title, parentId, lastModified, status)
 *   {pageId}.json     — raw ADF body for each page
 *   manifest.json     — top-level: sync timestamp + space list
 *
 * This script ONLY talks to the Confluence API.
 * Run build-confluence.mjs separately to convert the cache → content/confluence/.
 *
 * Required env vars:
 *   CONFLUENCE_API_TOKEN  — Atlassian personal access token
 *   CONFLUENCE_EMAIL      — account email for Basic auth
 *
 * Optional env vars:
 *   CONFLUENCE_CLOUD_ID       — defaults to hardcoded nourish cloud ID
 *   CONFLUENCE_SPACE_KEYS     — comma-separated keys to sync (default: all global spaces)
 *   CONFLUENCE_EXCLUDE_SPACES — comma-separated keys to skip
 *   CONFLUENCE_CONCURRENCY    — parallel spaces (default: 5)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_ROOT = join(__dirname, '..', '.confluence-cache')

// ── Config ────────────────────────────────────────────────────────────────────

const CLOUD_ID = process.env.CONFLUENCE_CLOUD_ID ?? '26a5fb48-bb0c-45aa-98fe-72e065c0e7dc'
const EMAIL = process.env.CONFLUENCE_EMAIL
const TOKEN = process.env.CONFLUENCE_API_TOKEN

if (!EMAIL || !TOKEN) {
  console.error('Error: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN must be set.')
  process.exit(1)
}

const ONLY_KEYS = process.env.CONFLUENCE_SPACE_KEYS
  ? new Set(process.env.CONFLUENCE_SPACE_KEYS.split(',').map((s) => s.trim().toUpperCase()))
  : null

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

async function pMap(items, fn, concurrency) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]) }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

// ── Confluence fetchers ───────────────────────────────────────────────────────

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

async function fetchPageAdf(pageId) {
  const data = await cfetch(`/pages/${pageId}`, { 'body-format': 'atlas_doc_format' })
  const adfRaw = data.body?.atlas_doc_format?.value
  let adf = null
  if (adfRaw) {
    try { adf = typeof adfRaw === 'string' ? JSON.parse(adfRaw) : adfRaw } catch { /* skip */ }
  }
  return {
    title: data.title ?? '',
    lastModified: data.version?.createdAt ?? data.createdAt ?? null,
    status: data.status ?? 'current',
    parentId: data.parentId ? String(data.parentId) : null,
    adf,
  }
}

// ── Cache one space ───────────────────────────────────────────────────────────

async function cacheSpace(space) {
  const spaceDir = join(CACHE_ROOT, space.key.toLowerCase())
  await mkdir(spaceDir, { recursive: true })

  const pages = await fetchAllPages(space.id)

  // Write the lightweight page listing (no ADF bodies — just metadata)
  const listing = pages.map((p) => ({
    id: String(p.id),
    title: p.title ?? '',
    parentId: p.parentId ? String(p.parentId) : null,
    status: p.status ?? 'current',
  }))
  await writeFile(join(spaceDir, 'pages.json'), JSON.stringify(listing, null, 2), 'utf-8')

  // Fetch and cache each page's ADF body
  let fetched = 0, errors = 0
  for (const page of pages) {
    try {
      await sleep(80)
      const detail = await fetchPageAdf(page.id)
      await writeFile(
        join(spaceDir, `${page.id}.json`),
        JSON.stringify(detail, null, 2),
        'utf-8',
      )
      fetched++
    } catch (err) {
      console.error(`    ✗  ${page.title ?? page.id}: ${err.message}`)
      errors++
    }
  }

  console.log(`  ${space.key.padEnd(16)} ${pages.length} pages — ${fetched} cached, ${errors} errors`)
  return { key: space.key, name: space.name, pageCount: fetched, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(CACHE_ROOT, { recursive: true })

  const syncedAt = new Date().toISOString()

  process.stdout.write('Fetching space list... ')
  let spaces = await fetchAllSpaces()
  console.log(`${spaces.length} global spaces`)

  if (ONLY_KEYS) {
    spaces = spaces.filter((s) => ONLY_KEYS.has(s.key.toUpperCase()))
    console.log(`Filtering to: ${[...ONLY_KEYS].join(', ')} → ${spaces.length} spaces`)
  } else {
    const excluded = spaces.filter((s) => EXCLUDE_KEYS.has(s.key.toUpperCase()))
    spaces = spaces.filter((s) => !EXCLUDE_KEYS.has(s.key.toUpperCase()))
    if (excluded.length) console.log(`Excluded: ${excluded.map((s) => s.key).join(', ')}`)
  }

  console.log(`Caching ${spaces.length} spaces (${CONCURRENCY} parallel):\n`)

  const results = await pMap(spaces, async (space) => {
    try {
      return await cacheSpace(space)
    } catch (err) {
      console.error(`  ✗  ${space.key}: ${err.message}`)
      return { key: space.key, name: space.name, pageCount: 0, errors: 1 }
    }
  }, CONCURRENCY)

  // Write manifest so build-confluence.mjs knows what was fetched
  const manifest = {
    syncedAt,
    spaces: results.map((r, i) => ({
      key: spaces[i].key,
      id: String(spaces[i].id),
      name: spaces[i].name,
      pageCount: r.pageCount,
    })),
  }
  await writeFile(join(CACHE_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  const total = results.reduce((n, r) => n + r.pageCount, 0)
  const totalErrors = results.reduce((n, r) => n + r.errors, 0)
  console.log(`\nCached ${total} pages across ${spaces.length} spaces.`)
  if (totalErrors) { console.error(`${totalErrors} errors.`); process.exit(1) }
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1) })

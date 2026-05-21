#!/usr/bin/env python3
"""
enrich_links.py — build a normalised # Links section for each imported card.

For each card in content/out-*.md and content/bp-*.md:
1. Read the corresponding vault source note.
2. Collect the Jira URL (from `source:` frontmatter) + any GitHub PR /
   Figma links found in the vault note.
3. Build a clean # Links block at the bottom of the file.
4. Remove `source:` from the card's own frontmatter (it's now in the body).

Link priority order in the output section:
  1. Jira link              (always, from source:)
  2. GitHub PR/repo links   (from vault, if present)
  3. Figma links            (from vault, if present)
  4. Labelled references    (e.g. "Related: OUT-548" — kept as plain text)
"""

import re
from pathlib import Path

VAULT_DIR = Path("/Users/callummclennan/Desktop/the-vault")
CONTENT_DIR = Path(__file__).parent.parent / "content"

# --------------------------------------------------------------------------- #
# Parsing helpers
# --------------------------------------------------------------------------- #

FM_RE = re.compile(r'^---\s*\n(.*?)^---\s*\n', re.DOTALL | re.MULTILINE)
SOURCE_RE = re.compile(r'^source:\s*(.+?)\s*$', re.MULTILINE)
MDLINK_RE = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
LABELED_URL_RE = re.compile(r'^[-*]?\s*([A-Za-z][\w\s]*):\s*(https?://\S+)', re.MULTILINE)
LABELED_ENTRY_RE = re.compile(r'^[A-Za-z][\w\s]*:\s+\S')  # "Related: OUT-548"


def parse_fm(text: str):
    """Return (fm_block, fm_text, body) or ('', '', text) if no frontmatter."""
    m = FM_RE.match(text)
    if not m:
        return '', '', text
    return text[: m.end()], m.group(1), text[m.end() :]


def remove_source_from_fm(fm_block: str) -> str:
    return re.sub(r'^source:[ \t]*.+\n', '', fm_block, flags=re.MULTILINE)


# --------------------------------------------------------------------------- #
# Vault note lookup
# --------------------------------------------------------------------------- #

def find_vault_note(card_stem: str) -> Path | None:
    """
    Map a card stem (e.g. 'out-606', 'bp-498') to its vault note path.
    Looks in References/ first, then root.
    """
    upper = card_stem.upper()  # OUT-606 / BP-498

    for candidate in [
        VAULT_DIR / "References" / f"{upper}.md",
        VAULT_DIR / f"{upper}.md",
    ]:
        if candidate.exists():
            return candidate

    return None


# --------------------------------------------------------------------------- #
# Link extraction from vault
# --------------------------------------------------------------------------- #

def is_useful_url(url: str) -> bool:
    return 'github.com' in url or 'figma.com' in url


def extract_vault_links(vault_path: Path) -> list[tuple[str, str]]:
    """
    Return (label, url) pairs for GitHub and Figma links found in the vault note.
    """
    text = vault_path.read_text(encoding='utf-8')
    links: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(label: str, url: str):
        key = url.rstrip('/')
        if key not in seen and is_useful_url(url):
            links.append((label.strip(), url.rstrip(')')))
            seen.add(key)

    # Markdown links: [label](url)
    for m in MDLINK_RE.finditer(text):
        add(m.group(1), m.group(2))

    # Labelled bare URLs: "- Figma: https://..."
    for m in LABELED_URL_RE.finditer(text):
        add(m.group(1).strip(), m.group(2).strip())

    return links


# --------------------------------------------------------------------------- #
# Links section extraction and rebuild
# --------------------------------------------------------------------------- #

def extract_links_section(body: str) -> tuple[str, str]:
    """
    Find and remove the `# Links` section (h1 only).
    Returns (body_without_section, section_body_text).
    """
    m = re.search(r'^# Links[ \t]*\n', body, re.MULTILINE)
    if not m:
        return body, ''

    start = m.start()
    content_start = m.end()

    # Section ends at the next h1 or EOF
    next_h1 = re.search(r'^# \S', body[content_start:], re.MULTILINE)
    end = content_start + next_h1.start() if next_h1 else len(body)

    section_body = body[content_start:end].strip()
    remaining = body[:start] + body[end:]
    return remaining, section_body


def collect_plain_references(section_body: str) -> list[str]:
    """
    Extract labelled non-URL entries from an existing Links section body.
    e.g. "Related: OUT-548" — kept as-is.
    Drops lines that were formerly dead wikilinks (plain text, no colon label).
    """
    refs = []
    for raw in section_body.split('\n'):
        line = re.sub(r'^[-*]\s+', '', raw.strip())
        if not line:
            continue
        if 'http' in line:
            continue          # handled elsewhere
        if '[[' in line or ']]' in line:
            continue          # dead wikilink remnant
        if LABELED_ENTRY_RE.match(line):
            refs.append(line)
        # bare titles (formerly dead wikilinks) — dropped
    return refs


def build_links_section(
    ticket_id: str,
    jira_url: str | None,
    vault_links: list[tuple[str, str]],
    existing_section_body: str,
) -> str:
    """Assemble a clean # Links section."""
    entries: list[str] = []
    seen: set[str] = set()

    def add_link(label: str, url: str):
        key = url.rstrip('/')
        if key in seen:
            return
        entries.append(f'[{label}]({url})')
        seen.add(key)

    # 1. Jira
    if jira_url:
        add_link(ticket_id.upper(), jira_url)

    # 2. GitHub links from vault
    for label, url in vault_links:
        if 'github.com' in url:
            add_link(label or url, url)

    # 3. Figma links from vault
    for label, url in vault_links:
        if 'figma.com' in url:
            # When the label IS the URL (auto-linked bare URL), use a tidy fallback
            is_url_label = label.startswith('http') or label == url
            display = 'Figma ↗' if is_url_label or label.lower() in ('figma', '') else label
            add_link(display, url)

    # 4. Labelled plain-text references from the old section ("Related: OUT-548")
    for ref in collect_plain_references(existing_section_body):
        if ref not in entries:
            entries.append(ref)

    if not entries:
        return ''

    lines = ['# Links', '']
    for entry in entries:
        lines.append(f'- {entry}')
    lines.append('')
    return '\n'.join(lines)


# --------------------------------------------------------------------------- #
# Main per-file processing
# --------------------------------------------------------------------------- #

ATLASSIAN_URL_RE = re.compile(r'https://[^/]+\.atlassian\.net/browse/[A-Z]+-\d+')


def process_card(path: Path) -> bool:
    card_stem = path.stem           # "out-606"
    original = path.read_text(encoding='utf-8')

    fm_block, fm_text, body = parse_fm(original)

    # Source URL (Jira) — try frontmatter first, then existing body, then derive from slug
    jira_url: str | None = None
    if fm_text:
        m = SOURCE_RE.search(fm_text)
        if m:
            jira_url = m.group(1).strip()
    if not jira_url:
        m = ATLASSIAN_URL_RE.search(body)
        if m:
            jira_url = m.group(0)
    if not jira_url and re.match(r'^(out|bp)-\d+$', card_stem):
        # Derive from the ticket slug: out-343 → OUT-343 → Jira URL
        jira_url = f'https://nourishcare.atlassian.net/browse/{card_stem.upper()}'

    # Vault links
    vault_path = find_vault_note(card_stem)
    vault_links = extract_vault_links(vault_path) if vault_path else []

    # Strip existing Links section from body
    body, existing_section_body = extract_links_section(body)

    # Build new Links section
    new_links = build_links_section(card_stem, jira_url, vault_links, existing_section_body)

    # Remove source: from frontmatter
    new_fm = remove_source_from_fm(fm_block) if fm_block else ''

    # Re-assemble: trim trailing whitespace from body, append Links at bottom
    body = body.rstrip()
    parts = [new_fm + body]
    if new_links:
        parts.append('\n\n' + new_links)

    result = ''.join(parts)
    if not result.endswith('\n'):
        result += '\n'

    if result == original:
        return False

    path.write_text(result, encoding='utf-8')
    return True


def main():
    changed, unchanged = [], []
    for pattern in ('out-*.md', 'bp-*.md'):
        for path in sorted(CONTENT_DIR.glob(pattern)):
            (changed if process_card(path) else unchanged).append(path.name)

    print(f'Modified {len(changed)}, unchanged {len(unchanged)}.')
    for name in changed:
        print(f'  {name}')


if __name__ == '__main__':
    main()

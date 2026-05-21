#!/usr/bin/env python3
"""
clean_cards.py — post-import cleanup for Quartz card files.

1. Removes empty section headers (headers with no body between them and the
   next header or EOF — only whitespace/blank lines in between).
2. Strips vault image embeds (![[Pasted image ...]]) — these files don't
   exist in the Quartz content tree.
3. Converts dead wikilinks to plain text:
   - Person-name wikilinks ([[Full Name|Alias]]) → Alias (strips PII links)
   - Person-name wikilinks ([[Full Name]]) → removes them entirely
   - Vault-only note wikilinks ([[Long Note Title]]) → plain text (no brackets)
   - OUT-/BP- wikilinks that resolve to existing files → kept as-is
   - Date wikilinks ([[YYYY-MM-DD]]) → kept as-is for graph connections
4. Strips stray Obsidian comment blocks (%% ... %%).
5. Wraps bare YYYY-MM-DD dates in [[...]] outside code blocks so they
   create graph edges between cards worked on the same day.
"""

import os
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).parent.parent / "content"

# --------------------------------------------------------------------------- #
# Build the set of valid slug targets (files that exist in content/)
# --------------------------------------------------------------------------- #

def build_known_slugs(content_dir: Path) -> set[str]:
    """
    Return a set of lowercase slugs (without extension) that correspond to
    real files in the content directory.  We include every .md file found,
    using its stem as the slug.
    """
    slugs = set()
    for md in content_dir.rglob("*.md"):
        slugs.add(md.stem.lower())
    return slugs

# --------------------------------------------------------------------------- #
# Person-name detection
# A wikilink target is a "person name" when it contains a space and looks
# like "Firstname Lastname" (no Jira-style prefix, no # or /).
# --------------------------------------------------------------------------- #

JIRA_PREFIX = re.compile(r'^(OUT|BP)-\d+', re.IGNORECASE)
VAULT_NOTE_PREFIXES = re.compile(
    r'^(Meeting |Valentina |Migration for |OUT-\d+ Rough)', re.IGNORECASE
)

def looks_like_person_name(target: str) -> bool:
    """
    Heuristic: two+ words, starts with a capital, no slashes, no Jira prefix.
    """
    parts = target.strip().split()
    if len(parts) < 2:
        return False
    if JIRA_PREFIX.match(target):
        return False
    # Every word should start with a capital letter (first and last name)
    if all(p[0].isupper() for p in parts if p):
        return True
    return False

# --------------------------------------------------------------------------- #
# Wikilink replacement
# --------------------------------------------------------------------------- #

# Matches  ![[anything]]  or  [[anything]]
WIKILINK_RE = re.compile(r'(!?)\[\[([^\]]+)\]\]')

def replace_wikilink(m: re.Match, known_slugs: set[str]) -> str:
    bang = m.group(1)
    inner = m.group(2)

    # ---- Image embeds: drop the whole thing --------------------------------
    if bang == "!":
        return ""

    # ---- Parse target + display parts --------------------------------------
    # Handles [[Target]], [[Target|Display]], [[Target|D1|D2]] (Obsidian quirk)
    parts = [p.strip() for p in inner.split("|")]
    target = parts[0]
    # Pick the first display alias if available
    display = parts[1] if len(parts) > 1 else ""

    target_slug = target.lower().replace(" ", "-")

    # ---- Keep valid inter-card wikilinks as-is -----------------------------
    if target_slug in known_slugs:
        return m.group(0)   # unchanged

    # ---- Keep date wikilinks as-is — they create graph edges ---------------
    if re.match(r'^\d{4}-\d{2}-\d{2}$', target_slug):
        return m.group(0)   # [[YYYY-MM-DD]] unchanged

    # ---- Person-name links: keep display text only (or remove) -------------
    if looks_like_person_name(target):
        return display if display else ""

    # ---- Meeting / personal vault notes: remove entirely -------------------
    if VAULT_NOTE_PREFIXES.match(target):
        return display if display else ""

    # ---- All other dead vault wikilinks: plain text (no brackets) ----------
    return display if display else target

# --------------------------------------------------------------------------- #
# Obsidian comment block removal  (%% ... %%)
# --------------------------------------------------------------------------- #

INLINE_COMMENT_RE = re.compile(r'%%.*?%%', re.DOTALL)

def strip_comments(text: str) -> str:
    return INLINE_COMMENT_RE.sub("", text)

# --------------------------------------------------------------------------- #
# Empty header removal
# --------------------------------------------------------------------------- #

HEADER_RE = re.compile(r'^(#{1,6})\s+\S')

def remove_empty_headers(lines: list[str]) -> list[str]:
    """
    Remove a header line when the only content before the next header (or EOF)
    is blank / whitespace-only lines.
    """
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if HEADER_RE.match(line):
            # Look ahead: skip blank lines
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            # If next non-blank line is another header or we hit EOF → empty section
            if j >= len(lines) or HEADER_RE.match(lines[j]):
                # Skip this header and the blank lines after it
                i = j
                continue
        result.append(line)
        i += 1
    return result

# --------------------------------------------------------------------------- #
# Date wikilink wrapping
# --------------------------------------------------------------------------- #

# Matches a bare date NOT already inside [[ ]]
_BARE_DATE_RE = re.compile(r'(?<!\[)\b(\d{4}-\d{2}-\d{2})\b(?!\])')
# Splits body on fenced code blocks and inline code spans
_CODE_SPLIT_RE = re.compile(r'(```[\s\S]*?```|`[^`\n]+`)')

def wrap_dates(body: str) -> str:
    """
    Wrap bare YYYY-MM-DD dates in [[...]] so they create graph edges.
    Skips content inside fenced code blocks and inline code spans.
    Already-wrapped [[YYYY-MM-DD]] dates are left unchanged.
    """
    segments = _CODE_SPLIT_RE.split(body)
    # split() with a capturing group → even indices are plain text, odd are code
    for i in range(0, len(segments), 2):
        segments[i] = _BARE_DATE_RE.sub(r'[[\1]]', segments[i])
    return "".join(segments)

# --------------------------------------------------------------------------- #
# Frontmatter split
# --------------------------------------------------------------------------- #

FM_RE = re.compile(r'^---\s*\n(.*?)^---\s*\n', re.DOTALL | re.MULTILINE)

def split_frontmatter(text: str):
    """Return (frontmatter_block_str, body_str) or ("", text) if none found."""
    m = FM_RE.match(text)
    if not m:
        return "", text
    return text[:m.end()], text[m.end():]

# --------------------------------------------------------------------------- #
# Main processing
# --------------------------------------------------------------------------- #

def process_file(path: Path, known_slugs: set[str]) -> bool:
    """Process a single file in place. Returns True if the file was modified."""
    original = path.read_text(encoding="utf-8")
    fm_block, body = split_frontmatter(original)

    # 1. Strip Obsidian comments
    body = strip_comments(body)

    # 2. Replace wikilinks in body
    body = WIKILINK_RE.sub(lambda m: replace_wikilink(m, known_slugs), body)

    # 3. Remove empty headers
    lines = body.splitlines(keepends=True)
    lines = remove_empty_headers(lines)
    body = "".join(lines)

    # 4. Remove list items that became empty after link-stripping
    #    e.g. "- Meeting: " (was "- Meeting: [[Meeting Joanne]]")
    #    Key must start with a letter to avoid catching date lines like "- 2026-03-17:"
    body = re.sub(r'^[ \t]*-[ \t]+[A-Za-z][A-Za-z ]*:[ \t]*\n', '', body, flags=re.MULTILINE)

    # 5. Collapse multiple consecutive blank lines into at most two
    body = re.sub(r'\n{3,}', '\n\n', body)

    # 6. Wrap bare dates in [[YYYY-MM-DD]] for graph connections
    body = wrap_dates(body)

    # Reassemble
    result = fm_block + body.lstrip("\n")
    if not result.endswith("\n"):
        result += "\n"

    if result == original:
        return False

    path.write_text(result, encoding="utf-8")
    return True


def main():
    known_slugs = build_known_slugs(CONTENT_DIR)

    # Process card files: out-*.md and bp-*.md at content root
    patterns = ["out-*.md", "bp-*.md"]
    changed = []
    unchanged = []

    for pattern in patterns:
        for path in sorted(CONTENT_DIR.glob(pattern)):
            if process_file(path, known_slugs):
                changed.append(path.name)
            else:
                unchanged.append(path.name)

    print(f"Modified {len(changed)} files, {len(unchanged)} unchanged.")
    if changed:
        print("Changed:")
        for name in changed:
            print(f"  {name}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Regenerate CLAUDE.md (section 1) and docs/*.md (sections 0, 2-16) from docs/SPEC_PACK.md.

Usage: python3 tools/split-spec.py            # from repo root
Keeps global section numbering (cross-references like "GDD 4.15" or "16.4" stay valid).
CLAUDE.md sections after the pack's section 1 (e.g. "1.9 Hand-over state") are preserved.
Run tools/gen-index.py afterwards to refresh docs/INDEX.md.
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = (root / 'docs/SPEC_PACK.md').read_text()
lines = src.split('\n')

PATHS = {
    0: 'docs/README.md', 1: 'CLAUDE.md', 2: 'docs/PRD.md', 3: 'docs/ORIGINAL_REFERENCE.md', 4: 'docs/GDD.md',
    5: 'docs/ARCHITECTURE.md', 6: 'docs/CONTENT_SCHEMAS.md', 7: 'docs/UX_SPEC.md', 8: 'docs/AUDIO_SPEC.md',
    9: 'docs/BALANCE_SPEC.md', 10: 'docs/MILESTONES.md', 11: 'docs/TEMPLATES.md', 12: 'docs/EXTENSIBILITY.md',
    13: 'docs/STATE_MODEL.md', 14: 'docs/SEED_DATA.md', 15: 'docs/BUILD_READINESS.md', 16: 'docs/ROADMAP_SCAFFOLDS.md',
}
KEEP_MARKER = '## 1.9 Hand-over state'

heads = [(i, l) for i, l in enumerate(lines) if re.match(r'^## \d+\. ', l)]
sections = {}
for k, (i, l) in enumerate(heads):
    j = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
    n = int(re.match(r'^## (\d+)\.', l).group(1))
    sections[n] = '\n'.join(lines[i:j]).rstrip() + '\n'


def promote(text):
    out, fence = [], False
    for l in text.split('\n'):
        if l.startswith('```'):
            fence = not fence
        if not fence and re.match(r'^#{2,6} ', l):
            l = l[1:]
        out.append(l)
    return '\n'.join(out)


def unescape(t):
    return t.replace('\\_', '_').replace('\\[', '[').replace('\\]', ']').replace('&#91;', '[')


for n, rel in PATHS.items():
    if n not in sections:
        print(f'section {n} missing in SPEC_PACK.md → {rel} untouched')
        continue
    text = unescape(promote(sections[n]))
    if n == 0:
        text = ('# Spec pack — index\n\n'
                '> Generated from `docs/SPEC_PACK.md` by `tools/split-spec.py`. Edit the pack, re-run the script; '
                'do not hand-edit the split files.\n\n' + text)
    target = root / rel
    if n == 1 and target.exists():
        old = target.read_text()
        if KEEP_MARKER in old:
            text = text.rstrip('\n') + '\n\n' + old[old.index(KEEP_MARKER):]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    print(f'{rel:32} {len(text):>7} bytes')

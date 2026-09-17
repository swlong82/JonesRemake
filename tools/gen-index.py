#!/usr/bin/env python3
"""Regenerate docs/INDEX.md (task -> cited spec sections) from docs/MILESTONES.md. Run from repo root."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
ms = (root / 'docs/MILESTONES.md').read_text()
DOCS = ('CLAUDE.md', 'GDD', 'PRD', 'ARCHITECTURE', 'CONTENT_SCHEMAS', 'UX_SPEC', 'AUDIO_SPEC', 'BALANCE_SPEC',
        'STATE_MODEL', 'SEED_DATA', 'EXTENSIBILITY', 'ROADMAP_SCAFFOLDS', 'BUILD_READINESS', 'ORIGINAL_REFERENCE')
doc_by_sec = {1: 'CLAUDE.md', 2: 'PRD.md', 3: 'ORIGINAL_REFERENCE.md', 4: 'GDD.md', 5: 'ARCHITECTURE.md',
              6: 'CONTENT_SCHEMAS.md', 7: 'UX_SPEC.md', 8: 'AUDIO_SPEC.md', 9: 'BALANCE_SPEC.md', 10: 'MILESTONES.md',
              12: 'EXTENSIBILITY.md', 13: 'STATE_MODEL.md', 14: 'SEED_DATA.md', 15: 'BUILD_READINESS.md',
              16: 'ROADMAP_SCAFFOLDS.md'}
rows, cur = [], None
for line in ms.splitlines():
    m = re.match(r'^## (M\d+) — ', line)
    if m:
        cur = m.group(1)
        continue
    t = re.match(r'^- \[[ x]\] (M\d+\.\d+) (.*)', line)
    if not t:
        continue
    tid, body = t.groups()
    refs = sorted({r for r in re.findall(r'\b(\d{1,2}\.\d{1,2})\b', body) if int(r.split('.')[0]) in doc_by_sec},
                  key=lambda s: [int(x) for x in s.split('.')])
    named = sorted(set(re.findall(r'\b(' + '|'.join(re.escape(d) for d in DOCS) + r')\b', body)))
    rows.append((cur, tid, body.split(' AC:')[0].strip(' .')[:70], refs, named))

out = ['# Spec index — task → sections', '',
       'Generated from the section citations in `docs/MILESTONES.md` (CLAUDE.md 1.1 step 3: read only what the task cites).',
       'Section numbers are global across the pack: `4.x` = GDD, `5.x` = ARCHITECTURE, `12.x` = EXTENSIBILITY, etc. (see `docs/README.md` file map).',
       'Regenerate after editing MILESTONES: `python3 tools/gen-index.py`.', '',
       '| Milestone | Task | Summary | Sections cited | Docs named |', '| --- | --- | --- | --- | --- |']
for cur, tid, summ, refs, named in rows:
    secs = ', '.join(f'{r} ({doc_by_sec[int(r.split(".")[0])]})' for r in refs) or '—'
    out.append(f'| {cur} | {tid} | {summ} | {secs} | {", ".join(named) or "—"} |')
out += ['', 'Always in scope for every task: `CLAUDE.md` (all), `docs/BUILD_READINESS.md` §15.6 and `docs/ROADMAP_SCAFFOLDS.md` §16.8 (amendments).', '']
(root / 'docs/INDEX.md').write_text('\n'.join(out))
print(f'docs/INDEX.md: {len(rows)} tasks')

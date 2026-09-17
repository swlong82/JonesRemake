# 11. Templates

CC creates these files in M0.8 with exactly this structure and keeps them current.

## PROGRESS.md

```markdown
# Progress
Current milestone: M0
Last updated: <ISO date> by <commit sha>

## M0 — Scaffold and CI
- [ ] M0.1 ... — note:
(copy every task from docs/MILESTONES.md)

## Gate log
| Milestone | Date | Commit | verify | CI | Notes |
|---|---|---|---|---|---|
```

## DECISIONS.md

```markdown
# Architecture & Design Decisions

## ADR-0001: <title>
- Date:
- Status: Accepted | Superseded by ADR-XXXX
- Context: (what spec section was silent/ambiguous, cite section number)
- Options: 1) ... 2) ...
- Decision:
- Consequences:
```

## KNOWN_ISSUES.md

```markdown
# Known Issues

## KI-001: <title>
- Severity: blocker | major | minor
- Area: engine | ai | content | web | audio | save | balance | ci
- Found in: <milestone/task>
- Repro: (seed, command log path or steps)
- Attempts: 1) ... 2) ... 3) ...
- Mitigation: feature flag <name> = off | workaround
- Status: open | fixed in <sha>
```

## NAMING.md

```markdown
# Naming (IP-safe)

## Title proposals (config.title = #1)
| # | Title | Rationale | Banned-term check |
|---|---|---|---|

## Rival AI names (one per personality)
| Personality | Name | Tagline |

## Locations (modern-western)
| Role | Name | Quip sample |

## Parody brands
| Real-world category | Parody name | Distinctness note |
```

## BASELINE_REPORT.md / BALANCE_REPORT.md

```markdown
# <Baseline|Balance> Report
Pack: <id>@<version>  Commit: <sha>  Games per config: <n>

## Gate results
| Gate | Target | Achieved | Pass |

## Game length by goal level
| Goals | p10 | median | p90 | stall % |

## Iterations (BALANCE only)
### Iteration <k> — <date>
- Changed: <constant>: <old> → <new> (rationale)
- Failing gates:
```

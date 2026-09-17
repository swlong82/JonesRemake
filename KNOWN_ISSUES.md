# Known Issues

## KI-001: Git tags cannot be pushed from the build session

- Severity: minor
- Area: ci
- Found in: M1 gate
- Repro: `git push origin refs/tags/m1` → `HTTP/1.1 403 Forbidden` from `git-receive-pack` (the session's egress policy only permits pushes to the working branch). Branch pushes succeed.
- Attempts: 1) `git push --tags` 2) `git push origin m1` 3) `git push origin refs/tags/m1` with trace — all 403.
- Mitigation: milestone tags (`m1`, `m2`, …) are created locally and listed in the PROGRESS gate log with their commit SHAs; the human pushes tags (`git push origin --tags`) or CI recreates them from the gate log. `git tag` names in this repo are still authoritative once pushed.
- Status: open

<!--
## KI-001: <title>
- Severity: blocker | major | minor
- Area: engine | ai | content | web | audio | save | balance | ci
- Found in: <milestone/task>
- Repro: (seed, command log path or steps)
- Attempts: 1) ... 2) ... 3) ...
- Mitigation: feature flag <name> = off | workaround
- Status: open | fixed in <sha>
-->

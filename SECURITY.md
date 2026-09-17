# Security Policy

This is a client-only browser game with no backend, no accounts and no network calls at runtime
(`CLAUDE.md` 1.3). The attack surface is the static bundle served from GitHub Pages and the
save-file import path.

## Supported versions

Only the latest commit on `main` (deployed to GitHub Pages) is supported.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting
("Report a vulnerability" under the Security tab) or contact the repository owner directly. Include
reproduction steps and, for save-file issues, the offending JSON. Expect an acknowledgement within
7 days.

## Scope notes

- Save import is validated with Zod before use; malformed or oversized files must be rejected, never
  partially applied.
- No third-party scripts, analytics, cookies or fonts are loaded at runtime.
- Dependency updates are automated via Dependabot; CI runs the full `pnpm verify` on every PR.

# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).
One entry per milestone (see `docs/MILESTONES.md`).

## [Unreleased]

### Added

- M0 scaffold: pnpm monorepo, TypeScript project references, ESLint boundaries, Vitest coverage gates,
  Playwright (3 viewports + axe), banned-terms scan, bundle budget, GitHub Actions CI + Pages deploy,
  spec pack under `docs/`, living templates at repo root.
- `docs/SPEC_PACK.md` as the single spec source; `tools/split-spec.py` + `tools/gen-index.py` regenerate the
  split docs and index. Spec version 2026-09-17 with amendments folded in.

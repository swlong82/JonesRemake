/** M0.8 AC: living templates exist with their section headers (docs/TEMPLATES.md). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (f: string): string => readFileSync(resolve(root, f), 'utf8');

describe('living templates', () => {
  it.each([
    ['PROGRESS.md', ['# Progress', '## M0 — Scaffold and CI', '## Gate log']],
    ['DECISIONS.md', ['# Architecture & Design Decisions', '## ADR-0001']],
    ['KNOWN_ISSUES.md', ['# Known Issues']],
    [
      'NAMING.md',
      [
        '# Naming (IP-safe)',
        '## Title proposals',
        '## Rival AI names',
        '## Locations',
        '## Parody brands',
      ],
    ],
    ['CHANGELOG.md', ['# Changelog', '## [Unreleased]']],
    ['README.md', ['## Play', '## Develop']],
  ])('%s has required headers', (file, headers) => {
    const text = read(file);
    for (const h of headers) expect(text).toContain(h);
  });
  it('spec pack files from the file map exist', () => {
    for (const f of [
      'CLAUDE.md',
      'LICENSE',
      'docs/PRD.md',
      'docs/ORIGINAL_REFERENCE.md',
      'docs/GDD.md',
      'docs/ARCHITECTURE.md',
      'docs/CONTENT_SCHEMAS.md',
      'docs/UX_SPEC.md',
      'docs/AUDIO_SPEC.md',
      'docs/BALANCE_SPEC.md',
      'docs/MILESTONES.md',
      'docs/EXTENSIBILITY.md',
      'docs/STATE_MODEL.md',
      'docs/SEED_DATA.md',
      'docs/BUILD_READINESS.md',
      'docs/ROADMAP_SCAFFOLDS.md',
      'docs/INDEX.md',
    ]) {
      expect(existsSync(resolve(root, f)), f).toBe(true);
    }
  });
});

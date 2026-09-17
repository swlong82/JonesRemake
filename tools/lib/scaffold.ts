import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface StubStatus {
  readonly area: string;
  readonly readme: 'ok' | 'missing' | 'no-replace-me-heading';
  readonly contractTest: boolean;
}

/** Every folder under packages/platform/src except `types.ts` is a stub area (ROADMAP_SCAFFOLDS 16). */
export function listStubs(platformSrc: string): StubStatus[] {
  return readdirSync(platformSrc)
    .filter((d) => statSync(join(platformSrc, d)).isDirectory())
    .sort()
    .map((area) => {
      const readmePath = join(platformSrc, area, 'README.md');
      let readme: StubStatus['readme'] = 'missing';
      if (existsSync(readmePath)) {
        readme = /^#\s*REPLACE ME\b/m.test(readFileSync(readmePath, 'utf8'))
          ? 'ok'
          : 'no-replace-me-heading';
      }
      return {
        area,
        readme,
        contractTest: existsSync(join(platformSrc, area, 'contract.test.ts')),
      };
    });
}

export function allHealthy(stubs: readonly StubStatus[]): boolean {
  return stubs.length > 0 && stubs.every((s) => s.readme === 'ok' && s.contractTest);
}

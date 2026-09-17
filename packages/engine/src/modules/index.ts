/** Module catalogue. Modern modules (M5) append here with `flag` set; order decides the pipeline. */
import type { RuleModule } from '../core/module.js';
import {
  coreBank,
  coreEducation,
  coreFood,
  coreHome,
  coreItems,
  coreJobs,
  coreMisc,
  coreTurn,
} from './core-commands.js';
import { coreDecay } from './core-decay.js';
import { coreEcon } from './core-econ.js';
import { coreEvents } from './core-events.js';
import { corePending } from './core-pending.js';
import { coreSetup } from './core-setup.js';

export const CORE_MODULES: readonly RuleModule[] = [
  coreSetup,
  coreEcon,
  corePending,
  coreEvents,
  coreDecay,
  coreTurn,
  coreJobs,
  coreEducation,
  coreHome,
  coreFood,
  coreItems,
  coreBank,
  coreMisc,
];

/** All modules known to this engine build (core + modern). Modern modules register themselves via `registerModules`. */
const extra: RuleModule[] = [];
export function registerModules(...mods: RuleModule[]): void {
  for (const m of mods) if (!extra.some((e) => e.id === m.id)) extra.push(m);
}
export function allModules(): readonly RuleModule[] {
  return [...CORE_MODULES, ...extra];
}

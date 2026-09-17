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
import { delivery } from './delivery.js';
import { gig } from './gig.js';
import { onlineStudy, registerOnlineStudyHooks } from './online-study.js';
import { rentHikes } from './rent-hikes.js';
import { subscriptions } from './subscriptions.js';
import { registerTransportHooks, transport } from './transport.js';
import { registerWellbeingHooks, wellbeing } from './wellbeing.js';

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

/**
 * Modern systems (M5). Each carries its `flag`, so `createEngine` drops it for a pack that does
 * not enable it and the UI never sees its commands (EXTENSIBILITY 12.4: no disabled stubs).
 */
export const MODERN_MODULES: readonly RuleModule[] = [
  wellbeing,
  transport,
  subscriptions,
  onlineStudy,
  delivery,
  rentHikes,
  gig,
];

// Core command hooks the modern modules extend (burnout pay penalty, lesson waste, transport).
registerWellbeingHooks();
registerTransportHooks();
registerOnlineStudyHooks();

/** All modules known to this engine build (core + modern). Packs may register more. */
const extra: RuleModule[] = [];
export function registerModules(...mods: RuleModule[]): void {
  for (const m of mods) if (!extra.some((e) => e.id === m.id)) extra.push(m);
}
export function allModules(): readonly RuleModule[] {
  return [...CORE_MODULES, ...MODERN_MODULES, ...extra];
}

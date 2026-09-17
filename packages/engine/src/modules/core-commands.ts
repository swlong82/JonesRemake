/** Classic command modules (EXTENSIBILITY 12.1): each registers its handlers; no turn hooks. */
import {
  buyAssetHandler,
  depositHandler,
  sellAssetHandler,
  withdrawHandler,
} from '../commands/bank.js';
import { enrollHandler, studyHandler } from '../commands/education.js';
import { buyFoodHandler, eatMealHandler } from '../commands/food.js';
import {
  moveHomeHandler,
  payRentHandler,
  relaxHandler,
  requestExtensionHandler,
} from '../commands/home.js';
import {
  buyItemHandler,
  redeemPawnHandler,
  repairHandler,
  sellItemHandler,
} from '../commands/items.js';
import { applyJobHandler, askRaiseHandler, workHandler } from '../commands/jobs.js';
import { buyLotteryHandler, readNewsHandler } from '../commands/misc.js';
import { endTurnHandler, enterHandler, exitHandler, moveHandler } from '../commands/turn.js';
import type { CommandHandler, RuleModule } from '../core/module.js';

const h = (x: unknown): CommandHandler => x as CommandHandler;

export const coreTurn: RuleModule = {
  id: 'core-turn',
  order: 50,
  commands: [h(moveHandler), h(enterHandler), h(exitHandler), h(endTurnHandler)],
};
export const coreJobs: RuleModule = {
  id: 'core-jobs',
  order: 51,
  commands: [h(applyJobHandler), h(askRaiseHandler), h(workHandler)],
};
export const coreEducation: RuleModule = {
  id: 'core-education',
  order: 52,
  commands: [h(enrollHandler), h(studyHandler)],
};
export const coreHome: RuleModule = {
  id: 'core-home',
  order: 53,
  commands: [h(relaxHandler), h(payRentHandler), h(requestExtensionHandler), h(moveHomeHandler)],
};
export const coreFood: RuleModule = {
  id: 'core-food',
  order: 54,
  commands: [h(buyFoodHandler), h(eatMealHandler)],
};
export const coreItems: RuleModule = {
  id: 'core-items',
  order: 55,
  commands: [h(buyItemHandler), h(sellItemHandler), h(redeemPawnHandler), h(repairHandler)],
};
export const coreBank: RuleModule = {
  id: 'core-bank',
  order: 56,
  commands: [h(depositHandler), h(withdrawHandler), h(buyAssetHandler), h(sellAssetHandler)],
};
export const coreMisc: RuleModule = {
  id: 'core-misc',
  order: 57,
  commands: [h(buyLotteryHandler), h(readNewsHandler)],
};

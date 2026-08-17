import type { Context } from '@deepseek-ai/cordis';
import './types.js';
import { Config } from './config.js';
import { clearTurnTracking } from './events.js';
export declare const name = "dsh-hooks";
export declare const inject: readonly ['sessions'];
export { Config };
export { hookMatches, matchFilters } from './events.js';
export { createHistorySink } from './history.js';
export declare function apply(ctx: Context, config?: Config): void;
export declare const _internals: {
    clearTurnTracking: typeof clearTurnTracking;
};

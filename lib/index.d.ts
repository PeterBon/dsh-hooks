import type { Context } from '@deepseek-ai/cordis';
import './types.js';
import { Config } from './config.js';
import { clearTurnTracking } from './events.js';
export declare const name = "dsh-hooks";
export declare const inject: readonly ['sessions'];
export { Config };
export { hookMatches, matchFilters } from './events.js';
export { createHistorySink } from './history.js';
/**
 * Model-facing announcement, installed only when the system-prompt service
 * exists (web profile). Tells agents the plugin exists and how to cooperate.
 */
export declare const DSH_HOOKS_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-hooks \u63D2\u4EF6\uFF08DeepSeek Harness \u914D\u7F6E\u9A71\u52A8\u751F\u547D\u5468\u671F hooks\uFF09\uFF1A\u53EF\u5728 profile \u7684 cordis.patch.yml \u58F0\u660E\u300C\u4E8B\u4EF6 \u2192 \u547D\u4EE4/\u901A\u77E5\u300D\u7684 hook\uFF08turn/start\u3001turn/end\u3001step/end\u3001tool/call\u3001tool/result\u3001user/message\u3001approval/asked\u3001session/title\u3001session/created\u3001session/disposed\u3001agent/created\u3001agent/disposed\u3001agent/error\u3001agent/status \u5171 14 \u7C7B\u4E8B\u4EF6\uFF09\uFF0C\u652F\u6301 when \u539F\u56E0\u8FC7\u6EE4\u3001match \u5B57\u6BB5\u6B63\u5219\u8FC7\u6EE4\u3001stdin JSON \u8F93\u5165\u3001opt-in \u91CD\u8BD5\u3001\u5185\u7F6E webhook/desktop \u901A\u77E5\u6E20\u9053\uFF1B\u6267\u884C\u5386\u53F2\u8BB0\u5F55\u4E8E ~/.dsh/dsh-hooks/history.jsonl\uFF1B`dsh-hooks dry-run <event>` \u53EF\u6A21\u62DF\u4E8B\u4EF6\u9A8C\u8BC1\u914D\u7F6E\u3002\u7528\u6237\u63D0\u5230\u300Chooks / \u94A9\u5B50 / \u751F\u547D\u5468\u671F / \u901A\u77E5\u914D\u7F6E\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
export declare function apply(ctx: Context, config?: Config): void;
export declare const _internals: {
    clearTurnTracking: typeof clearTurnTracking;
};

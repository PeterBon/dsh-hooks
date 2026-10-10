import { type HookContext } from './context.js';
/** What one successful attempt produced. */
export interface FeishuAttemptResult {
    kind: 'card' | 'text';
}
/**
 * Whether a Feishu failure is permanent (configuration/argument mistakes) as
 * opposed to worth retrying (transport, token, API status). The example module
 * reports configuration problems with a leading `缺少 ` / `无效的`.
 */
export declare function isPermanentFeishuError(message: string): boolean;
/**
 * Send one Feishu card (or text, per the script's arguments) for a hook context.
 *
 * The context's `DSH_HOOK_*` values are layered over the process environment
 * and mapped by the script's own `readEnv`, so credentials resolve exactly as
 * they do for the external script: `DSH_HOOKS_FEISHU_*` variables win over the
 * config file written by the QR setup flow.
 *
 * @param ctx - hook context to render.
 * @param configPath - credential file; defaults to the script's own default
 *   (`~/.dsh/dsh-hooks/feishu-config.json`).
 * @throws Error when the attempt fails; the caller decides retryability with
 *   {@link isPermanentFeishuError}.
 */
export declare function sendFeishuOnce(ctx: HookContext, configPath?: string): Promise<FeishuAttemptResult>;

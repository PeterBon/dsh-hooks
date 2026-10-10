/**
 * Built-in Feishu notification channel: one attempt of the very same card
 * pipeline the shipped `examples/notify-feishu.mjs` has always run, invoked
 * in-process instead of through an external script hook.
 *
 * Reuse, not a rewrite: the example module owns the credential merge, the
 * per-event card presentation (`eventPresentation` / `buildCard`) and the API
 * calls, and the QR setup flow already writes the same `feishu-config.json`.
 * A hook can therefore say `notify: { channel: 'feishu' }` and skip the copied
 * script (`~/.dsh/dsh-hooks/notify-feishu.mjs`) plus the five `run:` hooks the
 * setup flow used to generate.
 *
 * The retry policy lives in `notify.ts` ({@link attemptWithRetry}); this module
 * only performs one attempt and classifies its failure.
 */
import { readEnv, run as runFeishuNotify } from '../examples/notify-feishu.mjs'
import { toEnv, type HookContext } from './context.js'

/** What one successful attempt produced. */
export interface FeishuAttemptResult {
  kind: 'card' | 'text'
}

/**
 * Whether a Feishu failure is permanent (configuration/argument mistakes) as
 * opposed to worth retrying (transport, token, API status). The example module
 * reports configuration problems with a leading `缺少 ` / `无效的`.
 */
export function isPermanentFeishuError(message: string): boolean {
  return message.startsWith('缺少 ') || message.startsWith('无效的')
}

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
export async function sendFeishuOnce(ctx: HookContext, configPath?: string): Promise<FeishuAttemptResult> {
  const env = readEnv({ ...process.env, ...toEnv(ctx) })
  const result = await runFeishuNotify(env, [], configPath)
  return { kind: result.kind === 'text' ? 'text' : 'card' }
}

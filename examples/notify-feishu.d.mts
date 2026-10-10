/**
 * Typed surface of the shipped zero-dependency notify script
 * (`examples/notify-feishu.mjs`) for the TypeScript half. The `.mjs` module
 * resolves this `.d.mts` as its declaration, so lib code can import `run`
 * without allowJs. Declares the two entries lib code uses: the `run` pipeline
 * (setup flow, built-in `notify: { channel: 'feishu' }`) and `readEnv` (the
 * `DSH_HOOKS_FEISHU_*` → camelCase mapping the in-process channel needs, so
 * the mapping is not duplicated in TypeScript).
 */

/** Loose hook-context-like input the notify script merges with the config file. */
export interface NotifyFeishuContext {
  appId?: string
  appSecret?: string
  to?: string
  event?: string
  sessionId?: string
  sessionName?: string
  cwd?: string
  turn?: number | string
  reason?: string
  tool?: string
  status?: string
  error?: string
  content?: string
  timestamp?: string
  [key: string]: unknown
}

/** Map `DSH_HOOK*` environment variables onto the script's context shape. */
export declare function readEnv(env?: Record<string, string | undefined>): NotifyFeishuContext

export declare function run(
  ctx: NotifyFeishuContext,
  args?: string[],
  configPath?: string,
): Promise<{ kind: 'card' | 'text'; card?: unknown; text?: string }>

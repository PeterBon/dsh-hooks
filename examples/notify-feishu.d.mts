/**
 * Typed surface of the shipped zero-dependency notify script
 * (`examples/notify-feishu.mjs`) for the TypeScript half. The `.mjs` module
 * resolves this `.d.mts` as its declaration, so lib code can import `run`
 * without allowJs. Only the `run` entry the setup flow uses is declared.
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

export declare function run(
  ctx: NotifyFeishuContext,
  args?: string[],
  configPath?: string,
): Promise<{ kind: 'card' | 'text'; card?: unknown; text?: string }>

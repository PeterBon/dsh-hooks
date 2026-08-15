import Schema from '@deepseek-ai/schemastery'

/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export const HOOK_EVENTS = [
  'turn/start',
  'turn/end',
  'approval/asked',
  'agent/created',
  'agent/disposed',
  'agent/error',
  'agent/status',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/** `turn/end` reason kinds (from @deepseek-ai/dsh-session TurnEndReasonMap). */
export const TURN_END_REASONS = [
  'completed',
  'error',
  'aborted',
  'blocked',
  'max-tokens',
  'interrupted',
] as const

export type TurnEndReasonKind = (typeof TURN_END_REASONS)[number]

/** One declared hook: a matching event runs `run` through the platform shell. */
export interface HookSpec {
  /** Event that triggers the hook. */
  on: HookEvent
  /**
   * Optional filter. For `turn/end` it matches the reason kind
   * (`completed`, `error`, …). Ignored (and validated as absent) for
   * other events.
   */
  when?: string
  /** Command to spawn through the platform shell. */
  run: string
  /** Per-hook timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number
}

export interface Config {
  hooks?: HookSpec[]
}

// Explicit structural annotation: the inferred Schema type names the
// cosmokit transitive dependency, which is not portable across pnpm
// installations. Annotating with the schemastery callable shape keeps the
// declaration self-contained.
export const Config: {
  (data?: Config | null): Config
  meta: { description?: string | Record<string, string> }
} = Schema.object({
  hooks: Schema.array(
    Schema.object({
      on: Schema.union([...HOOK_EVENTS]).description(
        '触发事件：turn/start | turn/end | approval/asked | agent/created | agent/disposed | agent/error | agent/status',
      ),
      when: Schema.string().description(
        "可选过滤：对 turn/end 匹配结束原因（completed/error/aborted/blocked/max-tokens/interrupted）",
      ),
      run: Schema.string().required().description('触发时通过系统 shell 执行的命令'),
      timeoutMs: Schema.number().default(10000).description('单次执行超时（毫秒）'),
    }).description('一个事件 → 命令的 hook 声明'),
  )
    .default([])
    .description('事件触发时执行的外部命令列表；按声明顺序触发'),
}).description('dsh-hooks 配置：声明式生命周期 hooks')

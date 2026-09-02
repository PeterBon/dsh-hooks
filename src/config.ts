import Schema from '@deepseek-ai/schemastery'

/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export const HOOK_EVENTS = [
  'turn/start',
  'turn/end',
  'tree/settled',
  'step/end',
  'tool/call',
  'tool/result',
  'user/message',
  'approval/asked',
  'approval/decided',
  'session/title',
  'session/created',
  'session/disposed',
  'agent/created',
  'agent/disposed',
  'agent/error',
  'agent/status',
  'hook/failed',
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

/**
 * Built-in notification: send the hook context through a channel declared
 * in config, no external script required. Mutually exclusive with `run` —
 * a hook declares exactly one of the two.
 */
export interface NotifySpec {
  /** Channel to send through. */
  channel: 'webhook' | 'desktop'
  /** webhook: the target URL (falls back to the `DSH_HOOKS_WEBHOOK_URL` env var). */
  url?: string
  /** webhook: post a Slack-style `{ text }` one-line summary instead of the full context document. */
  slack?: boolean
}

/**
 * Numeric comparison filter for `match`: every declared op must hold for
 * the (numeric) context field. Declared in YAML as an object (`{ gt: 10000 }`)
 * or as an equivalent string (`'>10000'`); both compare against the field's
 * number value, never its string form.
 */
export interface NumericMatch {
  gt?: number
  gte?: number
  lt?: number
  lte?: number
  eq?: number
}

/** One hook: a matching event runs `run` (or sends `notify`). */
export interface HookSpec {
  /** Event that triggers the hook. */
  on: HookEvent
  /**
   * Optional filter. For `turn/end` it matches the reason kind
   * (`completed`, `error`, …). Ignored for other events.
   */
  when?: TurnEndReasonKind
  /**
   * Optional field → filter map: every declared filter must match the
   * context's field value for the hook to run. Values are regexes (tested
   * against the String-coerced field) or numeric comparisons (`{ gt: 10000 }`
   * / `'>10000'`, numbers only). Fields are `HookContext` keys (`tool`,
   * `sessionName`, `sessionId`, `error`, `source`, `cwd`, `content`, `turn`,
   * `durationMs`, `runningSubagents`, …); a field absent from the context
   * never matches.
   */
  match?: Record<string, RegExp | NumericMatch>
  /**
   * Command to spawn through the platform shell. Exactly one of `run` and
   * `notify` must be declared.
   */
  run?: string
  /** Built-in notification channel. Exactly one of `run` and `notify` must be declared. */
  notify?: NotifySpec | null
  /**
   * How the context reaches the command. `env` (default) passes the
   * `DSH_HOOK_*` variables only; `stdin` additionally writes the full
   * context as one JSON document to the command's stdin.
   */
  input?: 'env' | 'stdin'
  /** Per-hook timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number
  /**
   * Retry count for non-zero exit codes (default 0: fire-and-forget,
   * never retried). Spawn failures and timeouts are never retried.
   */
  retries?: number
  /** Base delay between retries in milliseconds; doubles per attempt. Defaults to 500. */
  retryDelayMs?: number
  /**
   * Disable this hook without deleting it: the declaration stays in config,
   * dispatch skips it silently (never counted as a failure). Defaults to true.
   */
  enabled?: boolean
  /**
   * Working directory for the spawned command. `'session'` runs in the
   * session's cwd (the project the agent works on); any other value must be
   * an absolute path. Defaults to the plugin process directory.
   */
  cwd?: 'session' | string
  /**
   * Maximum number of concurrently running processes for this hook.
   * Triggers beyond the limit are dropped (recorded as `skipped`). Defaults
   * to unlimited; `0` also means unlimited.
   */
  maxConcurrent?: number
  /**
   * Debounce window in milliseconds for high-frequency events (step/end,
   * tool/*, …): triggers inside the window collapse into one trailing
   * execution carrying the latest context. Defaults to 0 (disabled).
   */
  debounceMs?: number
}

/** Execution-history settings: in-memory ring buffer + optional JSONL log. */
export interface HistoryConfig {
  /** Persist records to disk. Defaults to true. */
  enabled?: boolean
  /** JSONL file path. Defaults to ~/.dsh/dsh-hooks/history.jsonl (0600). */
  path?: string
  /** In-memory ring buffer size. Defaults to 500. */
  max?: number
}

export interface Config {
  hooks?: HookSpec[]
  history?: HistoryConfig | null
  /**
   * Consecutive failure count (spawn-failed / exit-nonzero / timeout /
   * send-failed; one logical run counts once, internal retries included)
   * that emits the synthetic `hook/failed` event. Defaults to 3; values
   * below 1 are clamped to 1.
   */
  failedAlertThreshold?: number
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
        '触发事件：turn/start | turn/end | tree/settled | step/end | tool/call | tool/result | user/message | approval/asked | approval/decided | session/title | session/created | session/disposed | agent/created | agent/disposed | agent/error | agent/status | hook/failed',
      ),
      when: Schema.union([...TURN_END_REASONS]).description(
        '可选过滤：对 turn/end 匹配结束原因（completed/error/aborted/blocked/max-tokens/interrupted）；其他事件忽略该字段',
      ),
      match: Schema.dict(
        Schema.union([
          Schema.regExp(),
          Schema.object({
            gt: Schema.number(),
            gte: Schema.number(),
            lt: Schema.number(),
            lte: Schema.number(),
            eq: Schema.number(),
          }).description('数值比较（可组合，全部满足才匹配；要求上下文字段为数字）'),
        ]),
      ).description(
        '可选通用过滤：字段 → 正则或数值比较，全部匹配才触发。正则匹配字段的字符串表示；数值比较支持对象语法 { gt: 10000 } 或字符串语法 \'>10000\'（gt/gte/lt/lte/eq），只对数字字段生效，非数字字段永不匹配。字段为上下文键（tool/sessionName/sessionId/error/source/cwd/content/reason/turn/durationMs/runningSubagents/…），上下文中不存在的字段视为不匹配',
      ),
      run: Schema.string().description('触发时通过系统 shell 执行的命令（与 notify 二选一）'),
      notify: Schema.union([
        Schema.object({
          channel: Schema.union(['webhook', 'desktop'] as const)
            .required()
            .description('通知渠道：webhook 发 HTTP JSON；desktop 发系统桌面通知'),
          url: Schema.string().description('webhook 渠道的目标 URL（缺省时用环境变量 DSH_HOOKS_WEBHOOK_URL）'),
          slack: Schema.boolean().default(false).description('webhook 渠道：改为发送 Slack 风格 { text } 单行摘要'),
        }),
        Schema.const(null),
      ])
        .default(null)
        .description('内置通知（与 run 二选一）：配置驱动发送，无需外部脚本'),
      input: Schema.union(['env', 'stdin'] as const)
        .default('env')
        .description('上下文传递方式：env 只传 DSH_HOOK_* 环境变量（默认）；stdin 额外把完整上下文 JSON 写入命令标准输入'),
      timeoutMs: Schema.number().default(10000).description('单次执行超时（毫秒）'),
      retries: Schema.natural().default(0).description('非零退出码的重试次数（默认 0 不重试；spawn 失败与超时不重试）'),
      retryDelayMs: Schema.natural().default(500).description('重试基础间隔（毫秒），每次翻倍'),
      enabled: Schema.boolean()
        .default(true)
        .description('停用开关：false 保留配置但跳过派发（静默跳过，不计失败；默认 true）'),
      cwd: Schema.union([Schema.const('session'), Schema.string()]).description(
        '执行工作目录：session 在会话工作目录执行；绝对路径在指定目录执行；缺省用插件进程目录（只作用于 run）',
      ),
      maxConcurrent: Schema.natural().description(
        '该 hook 允许的最大并发进程数；超过上限的触发被丢弃（历史记 skipped）。缺省不限（0 同样视为不限）',
      ),
      debounceMs: Schema.natural().description(
        '去抖窗口（毫秒）：高频事件（step/end、tool/* 等）窗口内的多次触发合并为一次 trailing 执行，携带最新上下文。缺省 0 = 不去抖',
      ),
    }).description('一个事件 → 命令/通知的 hook 声明'),
  )
    .default([])
    .description('事件触发时执行的外部命令列表；按声明顺序触发'),
  history: Schema.union([
    Schema.object({
      enabled: Schema.boolean().default(true).description('是否把执行历史持久化到磁盘（默认 true）'),
      path: Schema.string().description('JSONL 文件路径（默认 ~/.dsh/dsh-hooks/history.jsonl，权限 0600）'),
      max: Schema.natural().default(500).description('内存环形缓冲条数（默认 500）'),
    }),
    Schema.const(null),
  ])
    .default(null)
    .description('hook 执行历史：内存环形缓冲 + 可选 JSONL 持久化日志（供 UI/调试使用，严格 best-effort）'),
  failedAlertThreshold: Schema.natural()
    .default(3)
    .description('同一 hook 连续失败达到该次数时发射 hook/failed 合成事件（spawn-failed/exit-nonzero/timeout/send-failed 计失败；一次逻辑执行的最终结果计一次，内部重试不另计；成功清零，触发后去抖）'),
}).description('dsh-hooks 配置：声明式生命周期 hooks')

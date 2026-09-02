/**
 * Hook execution context: a flat string map rendered into environment
 * variables and `{{var}}` placeholders. Never carries non-string values —
 * the runner owns serialization boundaries.
 */

export interface HookContext {
  event: string
  sessionId?: string
  /**
   * Readable session title (the latest `session/title` log event, or a
   * first-prompt fallback), when the session log offers one.
   */
  sessionName?: string
  /** Absolute working directory of the session, when known. */
  cwd?: string
  turn?: number
  /** Step number of the turn (step and tool events). */
  step?: number
  reason?: string
  tool?: string
  callId?: string
  /** Raw tool-call arguments JSON as the model produced it (tool/call). */
  toolArgs?: string
  /** Tool failure identity (`name`/`code`) when a tool result errored. */
  toolError?: string
  /** Producer source kind: user message source, title source, etc. */
  source?: string
  durationMs?: number
  status?: string
  error?: string
  /** Event content snapshot: turn assistant text, tool result text, … */
  content?: string
  /**
   * Wall-clock tool execution time, ms (tool/result only; undefined when the
   * pairing tool/call was never seen, e.g. after a plugin restart).
   */
  toolDurationMs?: number
  /** Aggregated token usage of the turn (turn/end), when reported. */
  usageInputTokens?: number
  usageOutputTokens?: number
  usageCacheReadTokens?: number
  usageCacheWriteTokens?: number
  usageReasoningTokens?: number
  /**
   * Number of live subagents still running under this session at `turn/end`
   * (0 = none). Always present on `turn/end`; the plugin fills the real count
   * from the agents/subagents services when they are available.
   */
  runningSubagents?: number
  /** Subagent lineage: the parent session id (session header `parentSession`). */
  parentSessionId?: string
  /** Whether the session was created as a subagent child (header `origin`). */
  subagent?: boolean
  /** Delegation depth from the session header; 0 = top-level session. */
  delegationDepth?: number
  /** Session creation time, epoch ms (session header `createdAt`). */
  sessionCreatedAt?: number
  /** Agent preset id that composed the session's agent (header `agentPreset`). */
  agentPreset?: string
  /** Approval audit id, pairing `approval/asked` with `approval/decided`. */
  approvalId?: string
  /** Approval decision outcome (approval/decided). */
  approvalOutcome?: string
  /** Total subagents in the settled tree (tree/settled). */
  totalSubagents?: number
  /** Parent turn/end → tree settle duration, ms (tree/settled). */
  treeDurationMs?: number
  /** Identity summary of the hook that failed consecutively (hook/failed). */
  hookFailedHook?: string
  /** Consecutive failure count when the alert fired (hook/failed). */
  hookFailures?: number
  timestamp: string
}

export function toEnv(ctx: HookContext): Record<string, string> {
  const env: Record<string, string> = { DSH_HOOK_EVENT: ctx.event, DSH_HOOK_TIMESTAMP: ctx.timestamp }
  if (ctx.sessionId !== undefined) env.DSH_HOOK_SESSION_ID = ctx.sessionId
  if (ctx.sessionName !== undefined) env.DSH_HOOK_SESSION_NAME = ctx.sessionName
  if (ctx.cwd !== undefined) env.DSH_HOOK_CWD = ctx.cwd
  if (ctx.turn !== undefined) env.DSH_HOOK_TURN = String(ctx.turn)
  if (ctx.step !== undefined) env.DSH_HOOK_STEP = String(ctx.step)
  if (ctx.reason !== undefined) env.DSH_HOOK_REASON = ctx.reason
  if (ctx.tool !== undefined) env.DSH_HOOK_TOOL = ctx.tool
  if (ctx.callId !== undefined) env.DSH_HOOK_CALL_ID = ctx.callId
  if (ctx.toolArgs !== undefined) env.DSH_HOOK_TOOL_ARGS = ctx.toolArgs
  if (ctx.toolError !== undefined) env.DSH_HOOK_TOOL_ERROR = ctx.toolError
  if (ctx.source !== undefined) env.DSH_HOOK_SOURCE = ctx.source
  if (ctx.durationMs !== undefined) env.DSH_HOOK_DURATION_MS = String(ctx.durationMs)
  if (ctx.status !== undefined) env.DSH_HOOK_STATUS = ctx.status
  if (ctx.error !== undefined) env.DSH_HOOK_ERROR = ctx.error
  if (ctx.content !== undefined) env.DSH_HOOK_CONTENT = ctx.content
  if (ctx.toolDurationMs !== undefined) env.DSH_HOOK_TOOL_DURATION_MS = String(ctx.toolDurationMs)
  if (ctx.usageInputTokens !== undefined) env.DSH_HOOK_USAGE_INPUT_TOKENS = String(ctx.usageInputTokens)
  if (ctx.usageOutputTokens !== undefined) env.DSH_HOOK_USAGE_OUTPUT_TOKENS = String(ctx.usageOutputTokens)
  if (ctx.usageCacheReadTokens !== undefined) env.DSH_HOOK_USAGE_CACHE_READ_TOKENS = String(ctx.usageCacheReadTokens)
  if (ctx.usageCacheWriteTokens !== undefined) env.DSH_HOOK_USAGE_CACHE_WRITE_TOKENS = String(ctx.usageCacheWriteTokens)
  if (ctx.usageReasoningTokens !== undefined) env.DSH_HOOK_USAGE_REASONING_TOKENS = String(ctx.usageReasoningTokens)
  if (ctx.runningSubagents !== undefined) env.DSH_HOOK_RUNNING_SUBAGENTS = String(ctx.runningSubagents)
  if (ctx.parentSessionId !== undefined) env.DSH_HOOK_PARENT_SESSION_ID = ctx.parentSessionId
  if (ctx.subagent !== undefined) env.DSH_HOOK_SUBAGENT = ctx.subagent ? '1' : '0'
  if (ctx.delegationDepth !== undefined) env.DSH_HOOK_DELEGATION_DEPTH = String(ctx.delegationDepth)
  if (ctx.sessionCreatedAt !== undefined) env.DSH_HOOK_SESSION_CREATED_AT = String(ctx.sessionCreatedAt)
  if (ctx.agentPreset !== undefined) env.DSH_HOOK_AGENT_PRESET = ctx.agentPreset
  if (ctx.approvalId !== undefined) env.DSH_HOOK_APPROVAL_ID = ctx.approvalId
  if (ctx.approvalOutcome !== undefined) env.DSH_HOOK_APPROVAL_OUTCOME = ctx.approvalOutcome
  if (ctx.totalSubagents !== undefined) env.DSH_HOOK_TOTAL_SUBAGENTS = String(ctx.totalSubagents)
  if (ctx.treeDurationMs !== undefined) env.DSH_HOOK_TREE_DURATION_MS = String(ctx.treeDurationMs)
  if (ctx.hookFailedHook !== undefined) env.DSH_HOOK_FAILED_HOOK = ctx.hookFailedHook
  if (ctx.hookFailures !== undefined) env.DSH_HOOK_FAILURES = String(ctx.hookFailures)
  return env
}

/** Render `{{DSH_HOOK_*}}` placeholders from the context map. */
export function renderTemplate(template: string, ctx: HookContext): string {
  const env = toEnv(ctx)
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(env, key) ? env[key] : whole,
  )
}

/** Human-readable label for an event, used in runner logs. */
export function eventLabel(ctx: HookContext): string {
  const session = ctx.sessionId ? ` · 会话 ${ctx.sessionName ?? ctx.sessionId}` : ''
  const extra =
    ctx.reason !== undefined
      ? ` · ${ctx.reason}`
      : ctx.tool !== undefined
        ? ` · 工具 ${ctx.tool}`
        : ctx.status !== undefined
          ? ` · ${ctx.status}`
          : ''
  return `${ctx.event}${extra}${session}`
}

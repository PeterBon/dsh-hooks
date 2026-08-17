import type { Session, SessionEvent, TurnEndReason } from '@deepseek-ai/dsh-session'
import type { HookContext } from './context.js'
import type { HookSpec, TurnEndReasonKind } from './config.js'
import type { AgentLike } from './types.js'

/** `approval/asked` payload (merge-extensible, declared by dsh-user-approval). */
export interface ApprovalAskedData {
  id: string
  toolName: string
  callId?: string
  reason?: string
}

/** `session/title` payload (merge-extensible, declared by dsh-session-title). */
export interface SessionTitleEventData {
  title: string
  messageSeqs: number[]
  source: { kind: 'fallback' } | { kind: 'provider'; provider?: unknown } | { kind: 'user' }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'approval/asked': ApprovalAskedData
    'session/title': SessionTitleEventData
  }
}

/** Agent lifecycle payloads (structural; emitted by dsh-agent's AgentService). */
export interface AgentCreatedPayload {
  agent: AgentLike
}

export interface AgentDisposedPayload {
  agent: AgentLike
}

export interface AgentErrorPayload {
  agent: AgentLike
  turn?: number
  step?: number
  error?: unknown
}

export interface AgentStatusPayload {
  agent: AgentLike
  status?: unknown
}

/** Per-session turn start timestamps for duration reporting. */
const turnStarts = new Map<string, number>()

/** Tool name for an in-flight call, remembered at `tool/call` and consumed at `tool/result`. */
const callTools = new Map<string, string>()

function sessionKey(session: Session): string {
  return String(session.id)
}

function callKey(session: Session, callId: unknown): string {
  return `${sessionKey(session)}\u0000${String(callId)}`
}

/** Best-effort access to a session's event log (test fakes may omit it). */
function sessionEvents(session: Session): readonly SessionEvent[] {
  return Array.isArray((session as { events?: unknown }).events) ? session.events : []
}

/** Concatenate the text blocks of a message's content, or undefined. */
function textOfBlocks(content: readonly { type?: unknown; text?: unknown }[] | undefined): string | undefined {
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  const text = parts.join('\n\n').trim()
  return text || undefined
}

/** Terminal-safe single line for a title: strip control/escape sequences. */
function oneLineTitle(input: unknown): string {
  return String(input)
    .replace(/\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Readable session title for notification cards. Mirrors the harness
 * session-title conventions without depending on the title service:
 * prefer the latest `session/title` log event (explicit rename, LLM title, or
 * deterministic fallback), otherwise derive one from the first direct human
 * prompt, as `dsh-session-title`'s fallback does.
 */
export function sessionTitle(session: Session): string | undefined {
  const events = sessionEvents(session)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i] as unknown as { type?: unknown; data?: { title?: unknown } }
    if (event.type !== 'session/title') continue
    const title = oneLineTitle(event.data?.title)
    if (title) return title.slice(0, 60)
  }
  for (const event of events) {
    if (event.type !== 'user/message') continue
    if ((event.data.source as { kind?: unknown }).kind !== 'user') continue
    const text = textOfBlocks(event.data.content)
    if (!text) continue
    const title = oneLineTitle(text)
    if (title) return title.slice(0, 60)
  }
  return undefined
}

/**
 * The turn's final assistant text, from the last `assistant/message` of that
 * turn. Capped so the environment snapshot stays small — card builders apply
 * their own display truncation.
 */
export function turnContent(session: Session, turn: number): string | undefined {
  let out: string | undefined
  for (const event of sessionEvents(session)) {
    if (event.type !== 'assistant/message') continue
    if (event.data.turn !== turn) continue
    const text = textOfBlocks(event.data.message.content)
    if (text) out = text
  }
  return out === undefined ? undefined : out.slice(0, 4000)
}

/** Structural token accounting (disjoint counts; cache fields optional). */
interface UsageLike {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/** Aggregated turn usage for hook contexts (only fields actually reported). */
export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/**
 * Sum the `usage` of every `assistant/message` of a turn. Steps without
 * reported accounting are skipped; returns undefined when no step reported
 * any usage (adapters may omit it entirely).
 */
export function turnUsage(session: Session, turn: number): UsageTotals | undefined {
  let totals: UsageTotals | undefined
  for (const event of sessionEvents(session)) {
    if (event.type !== 'assistant/message') continue
    if (event.data.turn !== turn) continue
    const usage = event.data.usage as UsageLike | undefined
    if (typeof usage?.inputTokens !== 'number') continue
    totals ??= { inputTokens: 0, outputTokens: 0 }
    totals.inputTokens += usage.inputTokens
    totals.outputTokens += usage.outputTokens
    if (typeof usage.cacheReadTokens === 'number') {
      totals.cacheReadTokens = (totals.cacheReadTokens ?? 0) + usage.cacheReadTokens
    }
    if (typeof usage.cacheWriteTokens === 'number') {
      totals.cacheWriteTokens = (totals.cacheWriteTokens ?? 0) + usage.cacheWriteTokens
    }
    if (typeof usage.reasoningTokens === 'number') {
      totals.reasoningTokens = (totals.reasoningTokens ?? 0) + usage.reasoningTokens
    }
  }
  return totals
}

export function rememberTurnStart(session: Session): void {
  turnStarts.set(sessionKey(session), Date.now())
}

function takeDuration(session: Session): number | undefined {
  const key = sessionKey(session)
  const started = turnStarts.get(key)
  turnStarts.delete(key)
  return started === undefined ? undefined : Date.now() - started
}

export function clearTurnTracking(session: Session): void {
  turnStarts.delete(sessionKey(session))
}

/** Does a declared hook match this event (type + optional `when` filter)? */
export function hookMatches(spec: HookSpec, event: string, reasonKind?: TurnEndReasonKind): boolean {
  if (spec.on !== event) return false
  if (spec.when === undefined) return true
  // v1 `when` semantics: only `turn/end` carries a reason to filter on.
  if (event !== 'turn/end') return true
  return spec.when === reasonKind
}

function baseContext(session: Session, event: string): HookContext {
  return {
    event,
    sessionId: sessionKey(session),
    sessionName: sessionTitle(session),
    cwd: session.header.cwd,
    timestamp: new Date().toISOString(),
  }
}

export function turnEndContext(session: Session, turn: number, reason: TurnEndReason | string): HookContext {
  const kind = typeof reason === 'string' ? reason : reason.kind
  let error: string | undefined
  if (typeof reason === 'object' && reason !== null && kind === 'error') {
    const failure = (reason as { error?: { message?: unknown } }).error
    if (typeof failure?.message === 'string') error = failure.message
  }
  const usage = turnUsage(session, turn)
  return {
    ...baseContext(session, 'turn/end'),
    turn,
    reason: kind,
    durationMs: takeDuration(session),
    error,
    content: turnContent(session, turn),
    usageInputTokens: usage?.inputTokens,
    usageOutputTokens: usage?.outputTokens,
    usageCacheReadTokens: usage?.cacheReadTokens,
    usageCacheWriteTokens: usage?.cacheWriteTokens,
    usageReasoningTokens: usage?.reasoningTokens,
  }
}

export function turnStartContext(session: Session, turn: number): HookContext {
  return { ...baseContext(session, 'turn/start'), turn }
}

export function stepEndContext(session: Session, turn: number, step: number): HookContext {
  return { ...baseContext(session, 'step/end'), turn, step }
}

export function toolCallContext(
  session: Session,
  turn: number,
  step: number,
  callId: unknown,
  name: unknown,
  args: unknown,
): HookContext {
  const key = callKey(session, callId)
  callTools.set(key, typeof name === 'string' ? name : String(name))
  return {
    ...baseContext(session, 'tool/call'),
    turn,
    step,
    tool: typeof name === 'string' ? name : String(name),
    callId: String(callId),
    toolArgs: typeof args === 'string' ? args.slice(0, 4000) : undefined,
  }
}

export function toolResultContext(
  session: Session,
  turn: number,
  step: number,
  callId: unknown,
  message: { content?: readonly { type?: unknown; text?: unknown }[] },
  error: { name?: unknown; code?: unknown } | undefined,
): HookContext {
  const key = callKey(session, callId)
  const tool = callTools.get(key)
  if (tool !== undefined) callTools.delete(key)
  let toolError: string | undefined
  if (error !== undefined) {
    const name = typeof error.name === 'string' ? error.name : undefined
    const code = typeof error.code === 'string' ? error.code : undefined
    if (name !== undefined || code !== undefined) toolError = [name, code].filter(Boolean).join(': ')
  }
  const content = textOfBlocks(message.content)
  return {
    ...baseContext(session, 'tool/result'),
    turn,
    step,
    tool,
    callId: String(callId),
    toolError,
    content: content === undefined ? undefined : content.slice(0, 4000),
  }
}

export function userMessageContext(session: Session, content: readonly { type?: unknown; text?: unknown }[], source: unknown): HookContext {
  const kind = typeof source === 'object' && source !== null && 'kind' in source
    ? String((source as { kind?: unknown }).kind)
    : undefined
  const text = textOfBlocks(content)
  return {
    ...baseContext(session, 'user/message'),
    source: kind,
    content: text === undefined ? undefined : text.slice(0, 4000),
  }
}

export function titleContext(session: Session, title: unknown, source: unknown): HookContext {
  const kind = typeof source === 'object' && source !== null && 'kind' in source
    ? String((source as { kind?: unknown }).kind)
    : undefined
  const cleaned = title === undefined ? undefined : oneLineTitle(title)
  return {
    ...baseContext(session, 'session/title'),
    sessionName: cleaned === undefined || cleaned === '' ? undefined : cleaned.slice(0, 60),
    source: kind,
  }
}

export function sessionCreatedContext(session: Session): HookContext {
  return {
    event: 'session/created',
    sessionId: sessionKey(session),
    sessionName: sessionTitle(session),
    cwd: session.header.cwd,
    timestamp: new Date().toISOString(),
  }
}

export function sessionDisposedContext(session: Session): HookContext {
  return {
    event: 'session/disposed',
    sessionId: sessionKey(session),
    sessionName: sessionTitle(session),
    cwd: session.header.cwd,
    timestamp: new Date().toISOString(),
  }
}

export function approvalContext(session: Session, data: ApprovalAskedData): HookContext {
  return {
    ...baseContext(session, 'approval/asked'),
    tool: data.toolName,
    callId: data.callId,
    reason: data.reason,
  }
}

export function agentCreatedContext(agent: AgentLike): HookContext {
  return {
    event: 'agent/created',
    sessionId: String(agent.id),
    timestamp: new Date().toISOString(),
  }
}

export function agentDisposedContext(agent: AgentLike): HookContext {
  return {
    event: 'agent/disposed',
    sessionId: String(agent.id),
    timestamp: new Date().toISOString(),
  }
}

export function agentErrorContext(agent: AgentLike, turn: number | undefined, error: unknown): HookContext {
  return {
    event: 'agent/error',
    sessionId: String(agent.id),
    turn,
    error: errorText(error),
    timestamp: new Date().toISOString(),
  }
}

export function agentStatusContext(agent: AgentLike, status: unknown): HookContext {
  return {
    event: 'agent/status',
    sessionId: String(agent.id),
    status: statusText(status),
    timestamp: new Date().toISOString(),
  }
}

/** Classify a session event into a hook context, or undefined when unmapped. */
export function classifySessionEvent(session: Session, event: SessionEvent): HookContext | undefined {
  switch (event.type) {
    case 'turn/start':
      rememberTurnStart(session)
      return turnStartContext(session, event.data.turn)
    case 'turn/end':
      return turnEndContext(session, event.data.turn, event.data.reason)
    case 'step/end':
      return stepEndContext(session, event.data.turn, event.data.step)
    case 'tool/call':
      return toolCallContext(
        session,
        event.data.turn,
        event.data.step,
        event.data.callId,
        event.data.name,
        event.data.arguments,
      )
    case 'tool/result': {
      // The call id rides the tool-result block (and the tool source), not
      // the event envelope — resolve it structurally with fallbacks.
      const block = event.data.message.content[0] as { toolCallId?: unknown } | undefined
      const source = event.data.message.source as { callId?: unknown } | undefined
      const callId = block?.toolCallId ?? source?.callId
      return toolResultContext(
        session,
        event.data.turn,
        event.data.step,
        callId,
        event.data.message.content[0],
        event.data.error,
      )
    }
    case 'user/message':
      return userMessageContext(session, event.data.content, event.data.source)
    case 'approval/asked':
      return approvalContext(session, event.data)
    case 'session/title':
      return titleContext(session, event.data.title, event.data.source)
    default:
      return undefined
  }
}

/** Best-effort error text from an arbitrary thrown value. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Best-effort status text from an agent status payload. */
export function statusText(status: unknown): string {
  if (typeof status === 'string') return status
  if (typeof status === 'object' && status !== null && 'kind' in status) {
    const kind = (status as { kind?: unknown }).kind
    if (typeof kind === 'string') return kind
  }
  return String(status)
}

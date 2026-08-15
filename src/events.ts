import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
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

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'approval/asked': ApprovalAskedData
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

function sessionKey(session: Session): string {
  return String(session.id)
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
  if (spec.when === undefined || spec.when === '') return true
  // v1 `when` semantics: only `turn/end` carries a reason to filter on.
  if (event !== 'turn/end') return true
  return spec.when === reasonKind
}

export function turnEndContext(session: Session, turn: number, reasonKind: string): HookContext {
  return {
    event: 'turn/end',
    sessionId: sessionKey(session),
    cwd: session.header.cwd,
    turn,
    reason: reasonKind,
    durationMs: takeDuration(session),
    timestamp: new Date().toISOString(),
  }
}

export function turnStartContext(session: Session, turn: number): HookContext {
  return {
    event: 'turn/start',
    sessionId: sessionKey(session),
    cwd: session.header.cwd,
    turn,
    timestamp: new Date().toISOString(),
  }
}

export function approvalContext(session: Session, data: ApprovalAskedData): HookContext {
  return {
    event: 'approval/asked',
    sessionId: sessionKey(session),
    cwd: session.header.cwd,
    tool: data.toolName,
    callId: data.callId,
    reason: data.reason,
    timestamp: new Date().toISOString(),
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
      return turnEndContext(session, event.data.turn, event.data.reason.kind)
    case 'approval/asked':
      return approvalContext(session, event.data)
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

import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import './types.js'
import { Config, type HookSpec, type TurnEndReasonKind } from './config.js'
import {
  agentCreatedContext,
  agentDisposedContext,
  agentErrorContext,
  agentStatusContext,
  classifySessionEvent,
  clearTurnTracking,
  hookMatches,
  type AgentCreatedPayload,
  type AgentDisposedPayload,
  type AgentErrorPayload,
  type AgentStatusPayload,
} from './events.js'
import type { HookContext } from './context.js'
import { createHookRunner } from './runner.js'

export const name = 'dsh-hooks'

// Dependency on the session service: `session/event` only exists once a
// SessionStore is composed, and this plugin consumes the durable firehose.
export const inject = ['sessions'] as const

export { Config }

export function apply(ctx: Context, config: Config = {}) {
  const hooks: readonly HookSpec[] = config.hooks ?? []
  const runner = createHookRunner((line) => ctx.logger?.info(line))

  const runMatching = (ctxValue: HookContext, reasonKind?: TurnEndReasonKind): void => {
    for (const hook of hooks) {
      if (!hookMatches(hook, ctxValue.event, reasonKind)) continue
      runner.run(hook, ctxValue)
    }
  }

  // Durable session firehose: turn boundaries and approval requests.
  ctx.on('session/event', (session: Session, event: unknown) => {
    const classified = classifySessionEvent(session, event as never)
    if (classified === undefined) return
    const reasonKind = extractReasonKind(event)
    runMatching(classified, reasonKind)
  })

  // Agent lifecycle events.
  ctx.on('agent/created', (payload: AgentCreatedPayload) => {
    runMatching(agentCreatedContext(payload.agent))
  })
  ctx.on('agent/disposed', (payload: AgentDisposedPayload) => {
    runMatching(agentDisposedContext(payload.agent))
  })
  ctx.on('agent/error', (payload: AgentErrorPayload) => {
    runMatching(agentErrorContext(payload.agent, payload.turn, payload.error))
  })
  ctx.on('agent/status', (payload: AgentStatusPayload) => {
    runMatching(agentStatusContext(payload.agent, payload.status))
  })

  ctx.effect(() => () => {
    runner.dispose()
  })
}

/** Extract the `turn/end` reason kind from a session event, when present. */
function extractReasonKind(event: unknown): TurnEndReasonKind | undefined {
  if (typeof event !== 'object' || event === null) return undefined
  const e = event as { type?: unknown; data?: { reason?: { kind?: unknown } } }
  if (e.type !== 'turn/end') return undefined
  return typeof e.data?.reason?.kind === 'string' ? (e.data.reason.kind as TurnEndReasonKind) : undefined
}

// Referenced only for tree-shaking clarity of the module contract; clearTurnTracking
// is exported for tests that need deterministic duration bookkeeping.
export const _internals = { clearTurnTracking }

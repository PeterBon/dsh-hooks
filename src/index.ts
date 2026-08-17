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
  matchFilters,
  sessionCreatedContext,
  sessionDisposedContext,
  type AgentCreatedPayload,
  type AgentDisposedPayload,
  type AgentErrorPayload,
  type AgentStatusPayload,
} from './events.js'
import { eventLabel, type HookContext } from './context.js'
import { createHookRunner } from './runner.js'
import { fireNotify } from './notify.js'
import { createHistorySink, type HistorySink } from './history.js'

export const name = 'dsh-hooks'

// Dependency on the session service: `session/event` only exists once a
// SessionStore is composed, and this plugin consumes the durable firehose.
export const inject = ['sessions'] as const

export { Config }
export { hookMatches, matchFilters } from './events.js'
export { createHistorySink } from './history.js'

export function apply(ctx: Context, config: Config = {}) {
  const hooks: readonly HookSpec[] = config.hooks ?? []
  const history: HistorySink = createHistorySink(config.history ?? undefined)
  const runner = createHookRunner((line) => ctx.logger?.info(line), (record) => history.record(record))

  const runMatching = (ctxValue: HookContext, reasonKind?: TurnEndReasonKind): void => {
    for (const hook of hooks) {
      if (!hookMatches(hook, ctxValue.event, reasonKind)) continue
      if (!matchFilters(hook.match, ctxValue)) continue
      if (hook.notify) {
        void fireNotify(hook.notify, ctxValue, (record) => history.record(record))
        continue
      }
      if (hook.run) {
        runner.run(hook, ctxValue)
        continue
      }
      console.warn(`[dsh-hooks] hook 既没有 run 也没有 notify，已跳过：${eventLabel(ctxValue)}`)
    }
  }

  // Durable session firehose: turn boundaries, steps, tool calls, messages,
  // titles, and approval requests.
  ctx.on('session/event', (session: Session, event: unknown) => {
    const classified = classifySessionEvent(session, event as never)
    if (classified === undefined) return
    const reasonKind = extractReasonKind(event)
    runMatching(classified, reasonKind)
  })

  // Session lifecycle (published by the session store, not the firehose).
  ctx.on('session/created', (session: Session) => {
    runMatching(sessionCreatedContext(session))
  })
  ctx.on('session/disposed', (session: Session) => {
    runMatching(sessionDisposedContext(session))
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

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
  hookFailedContext,
  hookMatches,
  matchFilters,
  sessionCreatedContext,
  sessionDisposedContext,
  treeSettledContext,
  type AgentCreatedPayload,
  type AgentDisposedPayload,
  type AgentErrorPayload,
  type AgentStatusPayload,
} from './events.js'
import { eventLabel, type HookContext } from './context.js'
import { createHookRunner } from './runner.js'
import { fireNotify } from './notify.js'
import { createHistorySink, type HistorySink, type HookRunRecord } from './history.js'
import { createFeishuSetupManager } from './feishu-session.js'
import { registerHookRoutes, type WebServerLike } from './server.js'

export const name = 'dsh-hooks'

/** Minimal structural contract of the optional `agents` service. */
interface AgentsLike {
  get(id: string): { id: string; status: string } | undefined
  list(): Array<{ id: string; status: string }>
  isOwnedBy(id: string, owner: { id: string }): boolean
}

/** Minimal structural contract of the optional `subagents` service. */
interface SubagentsLike {
  listDescendants(rootSessionId: string): Promise<Array<{ id?: string }>>
}

/** Snapshot of one session's subagent tree: live-running plus total descendants. */
export interface SubagentTreeStats {
  /** Descendants whose live agent status is `running`. */
  running: number
  /** Total descendants in the durable tree (running, idle, or settled). */
  total: number
}

/**
 * Inspect one session's descendant subagent tree.
 *
 * Lineage comes from the durable session tree (`subagents.listDescendants`,
 * driven by the session header `parentSession`): a subagent's runtime owner
 * in the agents registry is the subagent manager's host-level scope, not the
 * parent agent, so ownership chains (`agents.isOwnedBy`) cannot find children.
 * Only agents whose live status is `running` count as running — a settled/idle
 * continuable child does not. Returns `{ running: 0, total: 0 }` when the
 * session has no live agent or the services are unavailable.
 *
 * The live-registry scan is strictly a fallback for when listing is
 * unavailable (service absent or listing threw): a successful empty listing
 * stays empty, so ordinary subagent-free turns don't pay an O(registry) scan.
 */
export async function inspectSubagentTree(
  agents: AgentsLike,
  subagents: SubagentsLike | undefined,
  sessionId: string | undefined,
): Promise<SubagentTreeStats> {
  if (sessionId === undefined || agents.get(sessionId) === undefined) return { running: 0, total: 0 }
  let ids: string[] = []
  let listed = false
  if (subagents !== undefined) {
    try {
      ids = (await subagents.listDescendants(sessionId))
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string' && id !== sessionId)
      listed = true
    } catch {
      // listing unavailable — fall back to the live-registry child scan below
    }
  }
  if (!listed) {
    const owner = agents.get(sessionId)
    if (owner === undefined) return { running: 0, total: 0 }
    ids = agents
      .list()
      .filter((candidate) => candidate !== owner && agents.isOwnedBy(candidate.id, owner))
      .map((candidate) => candidate.id)
  }
  let running = 0
  for (const id of ids) {
    const agent = agents.get(id)
    if (agent !== undefined && agent.status === 'running') running++
  }
  return { running, total: ids.length }
}

/**
 * Count live agents still running in one session's descendant subagent tree
 * (the `running` half of {@link inspectSubagentTree}).
 */
export async function countRunningSubagents(
  agents: AgentsLike,
  subagents: SubagentsLike | undefined,
  sessionId: string | undefined,
): Promise<number> {
  return (await inspectSubagentTree(agents, subagents, sessionId)).running
}

// Dependency on the session service: `session/event` only exists once a
// SessionStore is composed, and this plugin consumes the durable firehose.
export const inject = ['sessions'] as const

export { Config }
export { hookMatches, matchFilters } from './events.js'
export { createHistorySink } from './history.js'

/**
 * Model-facing announcement, installed only when the system-prompt service
 * exists (web profile). Tells agents the plugin exists and how to cooperate.
 */
export const DSH_HOOKS_GUIDANCE =
  '本机已安装 dsh-hooks 插件（DeepSeek Harness 配置驱动生命周期 hooks）：可在 profile 的 cordis.patch.yml 声明「事件 → 命令/通知」的 hook（turn/start、turn/end、tree/settled、step/end、tool/call、tool/result、user/message、approval/asked、approval/decided、session/title、session/created、session/disposed、agent/created、agent/disposed、agent/error、agent/status、hook/failed 共 17 类事件），支持 when 原因过滤、match 字段正则/数值比较过滤（如 \'>10000\'）、stdin JSON 输入、opt-in 重试、执行选项（enabled 停用 / cwd 工作目录 / maxConcurrent + debounceMs 防高频风暴）、内置 webhook/desktop 通知渠道；执行历史记录于 ~/.dsh/dsh-hooks/history.jsonl；`dsh-hooks dry-run <event>` 可模拟事件验证配置。用户提到「hooks / 钩子 / 生命周期 / 通知配置」时即指本插件，请据此协作。'

export function apply(ctx: Context, config: Config = {}) {
  const hooks: readonly HookSpec[] = config.hooks ?? []
  const history: HistorySink = createHistorySink(config.history ?? undefined)
  const runner = createHookRunner((line) => ctx.logger?.info(line), (record) => history.record(record))

  // Web-profile extras: /dsh-hooks routes (incl. the Feishu connect flow)
  // and the agent announcement. Both services are optional — CLI/headless
  // profiles provide neither, and the plugin keeps working there untouched.
  const webServer = ctx.get('webServer', false) as WebServerLike | undefined
  if (webServer !== undefined) {
    const feishu = createFeishuSetupManager()
    ctx.effect(
      () => {
        const unregister = registerHookRoutes(webServer, { hooks, history, runner, feishu: { manager: feishu } })
        return () => {
          unregister()
          // Abort an in-flight QR scan so it never outlives the plugin.
          feishu.dispose()
        }
      },
      'dsh-hooks: /dsh-hooks routes',
    )
  }
  const systemPrompt = ctx.get('systemPrompt', false) as
    | { section(spec: { name: string; order?: number; text: string }): () => void }
    | undefined
  if (systemPrompt !== undefined) {
    ctx.effect(
      () => systemPrompt.section({ name: 'plugin:dsh-hooks', order: 200, text: DSH_HOOKS_GUIDANCE }),
      'dsh-hooks: prompt section',
    )
  }

  // Consecutive failure tracking for the synthetic hook/failed alert: a hook
  // that keeps failing is dead automation, and fire-and-forget dispatch would
  // otherwise let it rot silently. Counters are keyed by hook index, reset on
  // success, and the alert fires once per streak (dedup until a success).
  const failureThreshold = Math.max(1, config.failedAlertThreshold ?? 3)
  const failures = new Map<number, number>()
  const alerted = new Set<number>()

  /** One-line identity of a hook for failure alerts. */
  function hookFailureSummary(hook: HookSpec): string {
    const when = hook.when ? `/${hook.when}` : ''
    const action = hook.run ? hook.run : hook.notify ? `notify:${hook.notify.channel}` : '(既无 run 也无 notify)'
    return `${hook.on}${when}: ${action}`.slice(0, 200)
  }

  const runMatching = (ctxValue: HookContext, reasonKind?: TurnEndReasonKind): void => {
    hooks.forEach((hook, index) => {
      // enabled: false keeps the declaration but silences dispatch entirely —
      // skipped hooks are never failure-streak candidates.
      if (hook.enabled === false) return
      if (!hookMatches(hook, ctxValue.event, reasonKind)) return
      if (!matchFilters(hook.match, ctxValue)) return
      const debounceMs = hook.debounceMs ?? 0
      if (debounceMs > 0) {
        // Trailing-edge merge: triggers inside the window collapse into one
        // execution carrying the latest context. Dropped triggers stay silent
        // so high-frequency events cannot flood the log/history.
        const pending = debounceTimers.get(index)
        if (pending !== undefined) {
          pending.ctx = ctxValue
          return
        }
        const timer = setTimeout(() => {
          const armed = debounceTimers.get(index)
          debounceTimers.delete(index)
          if (armed !== undefined) dispatchHook(hook, index, armed.ctx)
        }, debounceMs)
        timer.unref?.()
        debounceTimers.set(index, { timer, ctx: ctxValue })
        return
      }
      dispatchHook(hook, index, ctxValue)
    })
  }

  /**
   * Dispatch one matched, enabled hook (run or notify). Outcome records are
   * attributed to the hook index so the failure streak sees the full
   * run/notify lifecycle (retries included).
   */
  const dispatchHook = (hook: HookSpec, index: number, ctxValue: HookContext): void => {
    const track = (record: Omit<HookRunRecord, 'ts'>): void => {
      history.record(record)
      const failed =
        record.outcome === 'spawn-failed' ||
        record.outcome === 'exit-nonzero' ||
        record.outcome === 'timeout' ||
        record.outcome === 'send-failed'
      if (failed) {
        const count = (failures.get(index) ?? 0) + 1
        failures.set(index, count)
        if (count >= failureThreshold && !alerted.has(index)) {
          alerted.add(index)
          runMatching(hookFailedContext(ctxValue, hookFailureSummary(hook), count))
        }
        return
      }
      if (record.outcome === 'exit-0' || record.outcome === 'sent') {
        failures.delete(index)
        alerted.delete(index)
      }
    }
    if (hook.notify) {
      void fireNotify(hook.notify, ctxValue, track)
      return
    }
    if (hook.run) {
      const limiter =
        hook.maxConcurrent !== undefined && hook.maxConcurrent > 0
          ? { id: `hook:${index}`, max: hook.maxConcurrent }
          : undefined
      runner.run(hook, ctxValue, track, limiter)
      return
    }
    console.warn(`[dsh-hooks] hook 既没有 run 也没有 notify，已跳过：${eventLabel(ctxValue)}`)
  }

  // Per-hook debounce state (trailing timers); cleared on dispose.
  const debounceTimers = new Map<number, { timer: ReturnType<typeof setTimeout>; ctx: HookContext }>()

  // turn/start content: the session log records `turn/start` BEFORE the
  // turn's `user/message`, so the initiating prompt text cannot be read at
  // turn-start time. When turn/start hooks exist, dispatch is deferred until
  // the turn's first direct user message is classified (its text attached as
  // `content`), or the turn ends without one (continuation/goal rounds) —
  // then it fires without content.
  const hasTurnStartHooks = hooks.some((hook) => hook.on === 'turn/start' && hook.enabled !== false)
  const pendingTurnStarts = new Map<string, { ctx: HookContext }>()

  /** Dispatch a deferred turn/start, optionally attaching the initiating text. */
  const flushTurnStart = (sessionId: string, content?: string): void => {
    const pending = pendingTurnStarts.get(sessionId)
    if (pending === undefined) return
    pendingTurnStarts.delete(sessionId)
    const ctxValue = content === undefined ? pending.ctx : { ...pending.ctx, content: content.slice(0, 2000) }
    runMatching(ctxValue)
  }

  // turn/end: fill the live running-subagent count before dispatching hooks,
  // so a hook can tell "work handed off to still-running subagents" apart from
  // "the turn finished for real". The services are read lazily at event time —
  // at plugin apply time the agents/subagents rows may not be composed yet.
  let warnedAgentsUnavailable = false

  /** Sessions whose turn ended with running subagents, awaiting tree settle. */
  interface WatchedTree {
    session: Session
    startedAt: number
  }
  const watchedTrees = new Map<string, WatchedTree>()

  /**
   * Re-check every watched tree on subagent-activity signals (any turn/end or
   * agent/status). Each entry is claimed (deleted) before its await, so a
   * concurrent refresh can never emit the same settle twice; entries whose
   * tree is still running are re-armed. Best-effort: a failed re-check or a
   * vanished service drops the watch silently instead of leaking it.
   */
  const refreshWatchedTrees = async (): Promise<void> => {
    if (watchedTrees.size === 0) return
    const agents = ctx.get('agents', false) as AgentsLike | undefined
    if (agents === undefined) {
      watchedTrees.clear()
      return
    }
    const subagents = ctx.get('subagents', false) as SubagentsLike | undefined
    for (const [sessionId, entry] of [...watchedTrees]) {
      watchedTrees.delete(sessionId)
      try {
        const { running, total } = await inspectSubagentTree(agents, subagents, sessionId)
        if (running === 0) {
          runMatching(treeSettledContext(entry.session, total, Date.now() - entry.startedAt))
        } else {
          watchedTrees.set(sessionId, entry)
        }
      } catch {
        // Re-check failed: the claim above already dropped the entry.
      }
    }
  }

  const matchAfterSubagentCount = async (session: Session, ctxValue: HookContext, reasonKind?: TurnEndReasonKind): Promise<void> => {
    const agents = ctx.get('agents', false) as AgentsLike | undefined
    if (agents === undefined) {
      // Warn once, not on every turn/end: profiles without the agents service
      // would otherwise spam the log on each turn boundary.
      if (!warnedAgentsUnavailable) {
        warnedAgentsUnavailable = true
        ctx.logger?.warn?.('[dsh-hooks] agents service unavailable at turn/end — runningSubagents stays 0')
      }
    } else {
      const subagents = ctx.get('subagents', false) as SubagentsLike | undefined
      const sessionId = String(session.id)
      try {
        const { running } = await inspectSubagentTree(agents, subagents, ctxValue.sessionId)
        ctxValue.runningSubagents = running
        if (running > 0) {
          // Work was handed off: watch this tree until it settles. A re-handoff
          // on a later turn restarts the settle clock from that turn/end.
          watchedTrees.set(sessionId, { session, startedAt: Date.now() })
        } else {
          watchedTrees.delete(sessionId)
        }
      } catch (error) {
        ctx.logger?.warn?.('[dsh-hooks] failed to count running subagents: %s', String(error))
      }
    }
    runMatching(ctxValue, reasonKind)
    void refreshWatchedTrees().catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-hooks] tree settle refresh failed: %s', String(error))
    })
  }

  // Durable session firehose: turn boundaries, steps, tool calls, messages,
  // titles, and approval requests.
  ctx.on('session/event', (session: Session, event: unknown) => {
    const classified = classifySessionEvent(session, event as never)
    if (classified === undefined) return
    const reasonKind = extractReasonKind(event)
    const sessionId = String(session.id)
    if (classified.event === 'turn/start') {
      if (!hasTurnStartHooks) {
        runMatching(classified, reasonKind)
        return
      }
      // A new turn claims the session: flush a previous unclaimed turn/start
      // (empty/rejected turn) without content, then arm the new one.
      flushTurnStart(sessionId)
      pendingTurnStarts.set(sessionId, { ctx: classified })
      return
    }
    if (classified.event === 'user/message') {
      // The turn's first direct user message completes the deferred turn/start
      // with the initiating text attached; synthetic messages (agent/plugin
      // sources) do not complete it.
      const pending = pendingTurnStarts.get(sessionId)
      if (pending !== undefined && classified.source === 'user') {
        pendingTurnStarts.delete(sessionId)
        const text = classified.content
        runMatching(text === undefined ? pending.ctx : { ...pending.ctx, content: text.slice(0, 2000) })
      }
      runMatching(classified, reasonKind)
      return
    }
    if (classified.event !== 'turn/end') {
      runMatching(classified, reasonKind)
      return
    }
    // The turn produced no direct user message (continuation round): dispatch
    // the deferred turn/start without content, then the turn/end flow.
    flushTurnStart(sessionId)
    // Dispatch is deferred past the async count; guard the fire-and-forget
    // promise so a synchronous throw inside dispatch surfaces as a log line
    // instead of an unhandled rejection.
    void matchAfterSubagentCount(session, classified, reasonKind).catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-hooks] turn/end dispatch failed: %s', String(error))
    })
  })

  // Session lifecycle (published by the session store, not the firehose).
  ctx.on('session/created', (session: Session) => {
    runMatching(sessionCreatedContext(session))
  })
  ctx.on('session/disposed', (session: Session) => {
    watchedTrees.delete(String(session.id))
    // A disposed session never completes its deferred turn/start — drop it.
    pendingTurnStarts.delete(String(session.id))
    runMatching(sessionDisposedContext(session))
    // A child session leaving the store is also settle-relevant activity.
    void refreshWatchedTrees().catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-hooks] tree settle refresh failed: %s', String(error))
    })
  })

  // Agent lifecycle events.
  ctx.on('agent/created', (payload: AgentCreatedPayload) => {
    runMatching(agentCreatedContext(payload.agent))
  })
  ctx.on('agent/disposed', (payload: AgentDisposedPayload) => {
    runMatching(agentDisposedContext(payload.agent))
    // A disposed (interrupted/killed) child agent can never settle on its
    // own — re-check watched trees so its parent's settle still fires.
    void refreshWatchedTrees().catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-hooks] tree settle refresh failed: %s', String(error))
    })
  })
  ctx.on('agent/error', (payload: AgentErrorPayload) => {
    runMatching(agentErrorContext(payload.agent, payload.turn, payload.error))
  })
  ctx.on('agent/status', (payload: AgentStatusPayload) => {
    runMatching(agentStatusContext(payload.agent, payload.status))
    // A child agent going idle is the settle signal for watched trees.
    void refreshWatchedTrees().catch((error: unknown) => {
      ctx.logger?.warn?.('[dsh-hooks] tree settle refresh failed: %s', String(error))
    })
  })

  ctx.effect(() => () => {
    runner.dispose()
    for (const entry of debounceTimers.values()) clearTimeout(entry.timer)
    debounceTimers.clear()
    pendingTurnStarts.clear()
    watchedTrees.clear()
  })
}

/** Extract the `turn/end` reason kind from a session event, when present. */
function extractReasonKind(event: unknown): TurnEndReasonKind | undefined {
  if (typeof event !== 'object' || event === null) return undefined
  const e = event as { type?: unknown; data?: { reason?: { kind?: unknown } } }
  if (e.type !== 'turn/end') return undefined
  return typeof e.data?.reason?.kind === 'string' ? (e.data.reason.kind as TurnEndReasonKind) : undefined
}

// Referenced only for tree-shaking clarity of the module contract; exported
// for tests that need deterministic bookkeeping.
export const _internals = { clearTurnTracking, countRunningSubagents, inspectSubagentTree }

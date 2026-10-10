import type { Session, SessionEvent, TurnEndReason } from '@deepseek-ai/dsh-session';
import type { HookContext } from './context.js';
import type { HookSpec, NumericMatch, TurnEndReasonKind } from './config.js';
import type { DailyUsageTotals, UsageTotals } from './usage.js';
import type { AgentLike } from './types.js';
export type { UsageTotals } from './usage.js';
/** `approval/asked` payload (merge-extensible, declared by dsh-user-approval). */
export interface ApprovalAskedData {
    id: string;
    toolName: string;
    callId?: string;
    reason?: string;
}
/** `approval/decided` payload (merge-extensible, declared by dsh-user-approval). */
export interface ApprovalDecidedData {
    id: string;
    outcome: string;
}
/** `session/title` payload (merge-extensible, declared by dsh-session-title). */
export interface SessionTitleEventData {
    title: string;
    messageSeqs: number[];
    source: {
        kind: 'fallback';
    } | {
        kind: 'provider';
        provider?: unknown;
    } | {
        kind: 'user';
    };
}
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'approval/asked': ApprovalAskedData;
        'approval/decided': ApprovalDecidedData;
        'session/title': SessionTitleEventData;
    }
}
/** Agent lifecycle payloads (structural; emitted by dsh-agent's AgentService). */
export interface AgentCreatedPayload {
    agent: AgentLike;
}
export interface AgentDisposedPayload {
    agent: AgentLike;
}
export interface AgentErrorPayload {
    agent: AgentLike;
    turn?: number;
    step?: number;
    error?: unknown;
}
export interface AgentStatusPayload {
    agent: AgentLike;
    status?: unknown;
}
/**
 * Readable session title for notification cards. Mirrors the harness
 * session-title conventions without depending on the title service:
 * prefer the latest `session/title` log event (explicit rename, LLM title, or
 * deterministic fallback), otherwise derive one from the first direct human
 * prompt, as `dsh-session-title`'s fallback does.
 */
export declare function sessionTitle(session: Session): string | undefined;
/**
 * Session title through {@link sessionTitles}: computed once per session, then
 * refreshed by {@link rememberSessionTitle} from the events that can change it.
 */
export declare function cachedSessionTitle(session: Session): string | undefined;
/** Refresh the cached title after an event that can set or rename it. */
export declare function rememberSessionTitle(session: Session): void;
/**
 * The turn's final assistant text, from the last `assistant/message` of that
 * turn. Capped so the environment snapshot stays small — card builders apply
 * their own display truncation.
 */
export declare function turnContent(session: Session, turn: number): string | undefined;
/** One turn's derived facts: final assistant text plus summed token usage. */
export interface TurnDigest {
    content?: string;
    usage?: UsageTotals;
}
/**
 * Walk the session log **once** for a turn and return both the final assistant
 * text and the summed usage.
 *
 * `turnContent` and `turnUsage` used to walk the log separately, and the host's
 * `snapshotEvents()` returns a fresh frozen copy per call, so every `turn/end`
 * paid two full array copies plus two scans on a long session. Callers that
 * need both go through here; the two single-purpose accessors remain as thin
 * wrappers for compatibility.
 */
export declare function turnDigest(session: Session, turn: number): TurnDigest;
/**
 * Sum the `usage` of every `assistant/message` of a turn. Steps without
 * reported accounting are skipped; returns undefined when no step reported
 * any usage (adapters may omit it entirely).
 */
export declare function turnUsage(session: Session, turn: number): UsageTotals | undefined;
export declare function rememberTurnStart(session: Session): void;
export declare function clearTurnTracking(session: Session): void;
/**
 * Drop every pairing this session left behind: its turn-start timestamp, its
 * in-flight `tool/call` entries, and its pending `approval/asked` entries.
 *
 * Called when a session leaves the store. Without it the three maps above grow
 * for the life of the host process — a `tool/call` whose result never arrives
 * (interrupted turn, killed subagent) or an unanswered approval keeps its entry
 * forever, and every session that starts a turn without a normal `turn/end`
 * leaves a timestamp behind.
 */
export declare function clearSessionTracking(session: Session): void;
/** Does a declared hook match this event (type + optional `when` filter)? */
export declare function hookMatches(spec: HookSpec, event: string, reasonKind?: TurnEndReasonKind): boolean;
/**
 * Apply the optional `match` field → filter map. Each value is either a
 * regex (compiled by the config schema; tested against the String-coerced
 * field) or a numeric comparison — declared as an object (`{ gt: 10000 }`)
 * or as a string that parses as one (`'>10000'`). Comparison semantics
 * apply only when the context field is a number; on a non-numeric field a
 * comparison never matches. Every declared filter must pass. An empty or
 * absent `match` passes everything; unsupported shapes never match.
 */
export declare function matchFilters(match: Record<string, RegExp | NumericMatch> | undefined, ctx: HookContext): boolean;
export declare function turnEndContext(session: Session, turn: number, reason: TurnEndReason | string): HookContext;
export declare function turnStartContext(session: Session, turn: number): HookContext;
export declare function stepEndContext(session: Session, turn: number, step: number): HookContext;
export declare function toolCallContext(session: Session, turn: number, step: number, callId: unknown, name: unknown, args: unknown): HookContext;
/**
 * Last-resort tool name for a `tool/result` whose `tool/call` was never paired
 * (plugin applied mid-session, or a restart between call and result): the call
 * event is already in the session log, so read it back.
 *
 * Bounded backward walk — a call precedes its result, so a live turn's match is
 * near the end; the cap keeps a pathological log (or a stale callId) from
 * costing a full scan on every result.
 */
export declare function toolNameFromLog(session: Session, callId: unknown): string | undefined;
export declare function toolResultContext(session: Session, turn: number, step: number, callId: unknown, message: {
    content?: readonly {
        type?: unknown;
        text?: unknown;
    }[];
}, error: {
    name?: unknown;
    code?: unknown;
    reason?: unknown;
} | undefined): HookContext;
export declare function userMessageContext(session: Session, content: readonly {
    type?: unknown;
    text?: unknown;
}[], source: unknown): HookContext;
export declare function titleContext(session: Session, title: unknown, source: unknown): HookContext;
export declare function sessionCreatedContext(session: Session): HookContext;
export declare function sessionDisposedContext(session: Session): HookContext;
export declare function approvalContext(session: Session, data: ApprovalAskedData): HookContext;
export declare function approvalDecidedContext(session: Session, data: ApprovalDecidedData): HookContext;
/**
 * Synthetic `tree/settled` context: the session's whole subagent tree has
 * settled (no live child still running) after a turn ended with work handed
 * off. Emitted by index.ts, not classified from a session log event.
 */
export declare function treeSettledContext(session: Session, totalSubagents: number, treeDurationMs: number): HookContext;
/**
 * Synthetic `hook/failed` context: one hook failed consecutively past the
 * alert threshold. Emitted by index.ts from the runner/history outcome
 * stream, not classified from a session log event; `origin` supplies the
 * session identity of the event that triggered the failing hook.
 */
export declare function hookFailedContext(origin: HookContext, hookFailedHook: string, hookFailures: number): HookContext;
/**
 * Synthetic `usage/daily` context: the local calendar day that just ended,
 * with its aggregated token usage. Emitted by index.ts when the day rolls
 * over (detected from ordinary event traffic — no timers); `origin` supplies
 * the session identity of the event that triggered the report.
 *
 * The token fields reuse the `turn/end` names on purpose: a hook reads the
 * same variables, with the day's aggregate instead of one turn's.
 */
export declare function usageDailyContext(origin: HookContext, totals: DailyUsageTotals): HookContext;
export declare function agentCreatedContext(agent: AgentLike): HookContext;
export declare function agentDisposedContext(agent: AgentLike): HookContext;
export declare function agentErrorContext(agent: AgentLike, turn: number | undefined, error: unknown): HookContext;
export declare function agentStatusContext(agent: AgentLike, status: unknown): HookContext;
/** Classify a session event into a hook context, or undefined when unmapped. */
export declare function classifySessionEvent(session: Session, event: SessionEvent): HookContext | undefined;
/** Best-effort error text from an arbitrary thrown value. */
export declare function errorText(error: unknown): string;
/** Best-effort status text from an agent status payload. */
export declare function statusText(status: unknown): string;

import type { Session, SessionEvent, TurnEndReason } from '@deepseek-ai/dsh-session';
import type { HookContext } from './context.js';
import type { HookSpec, NumericMatch, TurnEndReasonKind } from './config.js';
import type { AgentLike } from './types.js';
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
 * The turn's final assistant text, from the last `assistant/message` of that
 * turn. Capped so the environment snapshot stays small — card builders apply
 * their own display truncation.
 */
export declare function turnContent(session: Session, turn: number): string | undefined;
/** Aggregated turn usage for hook contexts (only fields actually reported). */
export interface UsageTotals {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
}
/**
 * Sum the `usage` of every `assistant/message` of a turn. Steps without
 * reported accounting are skipped; returns undefined when no step reported
 * any usage (adapters may omit it entirely).
 */
export declare function turnUsage(session: Session, turn: number): UsageTotals | undefined;
export declare function rememberTurnStart(session: Session): void;
export declare function clearTurnTracking(session: Session): void;
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
export declare function toolResultContext(session: Session, turn: number, step: number, callId: unknown, message: {
    content?: readonly {
        type?: unknown;
        text?: unknown;
    }[];
}, error: {
    name?: unknown;
    code?: unknown;
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

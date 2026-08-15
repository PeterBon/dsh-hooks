import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import type { HookContext } from './context.js';
import type { HookSpec, TurnEndReasonKind } from './config.js';
import type { AgentLike } from './types.js';
/** `approval/asked` payload (merge-extensible, declared by dsh-user-approval). */
export interface ApprovalAskedData {
    id: string;
    toolName: string;
    callId?: string;
    reason?: string;
}
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'approval/asked': ApprovalAskedData;
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
export declare function rememberTurnStart(session: Session): void;
export declare function clearTurnTracking(session: Session): void;
/** Does a declared hook match this event (type + optional `when` filter)? */
export declare function hookMatches(spec: HookSpec, event: string, reasonKind?: TurnEndReasonKind): boolean;
export declare function turnEndContext(session: Session, turn: number, reasonKind: string): HookContext;
export declare function turnStartContext(session: Session, turn: number): HookContext;
export declare function approvalContext(session: Session, data: ApprovalAskedData): HookContext;
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

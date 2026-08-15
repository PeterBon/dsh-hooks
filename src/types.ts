/**
 * Event declarations for the `agent/*` lifecycle events emitted by
 * `@deepseek-ai/dsh-agent`. This plugin does not hard-depend on dsh-agent:
 * the payload shapes are structural and declared here so `ctx.on` calls
 * type-check against the harness Events map without pulling the agent
 * package into the dependency graph.
 */

export interface AgentLike {
  id: unknown
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/created'(this: { id: unknown }, payload: { agent: AgentLike }): void
    'agent/disposed'(this: { id: unknown }, payload: { agent: AgentLike }): void
    'agent/error'(this: { id: unknown }, payload: {
      agent: AgentLike
      turn?: number
      step?: number
      error?: unknown
    }): void
    'agent/status'(this: { id: unknown }, payload: {
      agent: AgentLike
      status?: unknown
    }): void
  }
}

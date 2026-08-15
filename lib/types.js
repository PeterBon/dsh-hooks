/**
 * Event declarations for the `agent/*` lifecycle events emitted by
 * `@deepseek-ai/dsh-agent`. This plugin does not hard-depend on dsh-agent:
 * the payload shapes are structural and declared here so `ctx.on` calls
 * type-check against the harness Events map without pulling the agent
 * package into the dependency graph.
 */
export {};

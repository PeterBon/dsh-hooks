import { describe, expect, it } from 'vitest'
import { eventLabel, renderTemplate, toEnv } from '../src/context.js'

describe('toEnv', () => {
  it('always carries event and timestamp', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect(env.DSH_HOOK_EVENT).toBe('turn/end')
    expect(env.DSH_HOOK_TIMESTAMP).toBe('T')
  })

  it('omits undefined fields', () => {
    const env = toEnv({ event: 'agent/created', sessionId: 's1', timestamp: 'T' })
    expect(env.DSH_HOOK_SESSION_ID).toBe('s1')
    expect('DSH_HOOK_TURN' in env).toBe(false)
    expect('DSH_HOOK_REASON' in env).toBe(false)
  })

  it('stringifies numbers', () => {
    const env = toEnv({ event: 'turn/end', turn: 7, durationMs: 1234, timestamp: 'T' })
    expect(env.DSH_HOOK_TURN).toBe('7')
    expect(env.DSH_HOOK_DURATION_MS).toBe('1234')
  })

  it('carries session name and content when present', () => {
    const env = toEnv({ event: 'turn/end', sessionName: '修复构建', content: '已修复', timestamp: 'T' })
    expect(env.DSH_HOOK_SESSION_NAME).toBe('修复构建')
    expect(env.DSH_HOOK_CONTENT).toBe('已修复')
  })

  it('omits session name and content when absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_SESSION_NAME' in env).toBe(false)
    expect('DSH_HOOK_CONTENT' in env).toBe(false)
  })

  it('carries step, tool call, and source fields', () => {
    const env = toEnv({
      event: 'tool/call',
      step: 3,
      tool: 'pwsh',
      callId: 'call-1',
      toolArgs: '{"a":1}',
      toolError: 'EACCES: x',
      source: 'user',
      timestamp: 'T',
    })
    expect(env.DSH_HOOK_STEP).toBe('3')
    expect(env.DSH_HOOK_TOOL).toBe('pwsh')
    expect(env.DSH_HOOK_CALL_ID).toBe('call-1')
    expect(env.DSH_HOOK_TOOL_ARGS).toBe('{"a":1}')
    expect(env.DSH_HOOK_TOOL_ERROR).toBe('EACCES: x')
    expect(env.DSH_HOOK_SOURCE).toBe('user')
  })

  it('carries tool duration on tool/result', () => {
    const env = toEnv({ event: 'tool/result', toolDurationMs: 1234, timestamp: 'T' })
    expect(env.DSH_HOOK_TOOL_DURATION_MS).toBe('1234')
    expect(toEnv({ event: 'tool/result', timestamp: 'T' }).DSH_HOOK_TOOL_DURATION_MS).toBeUndefined()
  })

  it('omits the tool/source fields when absent', () => {
    const env = toEnv({ event: 'step/end', timestamp: 'T' })
    expect('DSH_HOOK_STEP' in env).toBe(false)
    expect('DSH_HOOK_TOOL_ARGS' in env).toBe(false)
    expect('DSH_HOOK_TOOL_ERROR' in env).toBe(false)
    expect('DSH_HOOK_SOURCE' in env).toBe(false)
  })

  it('carries aggregated usage fields', () => {
    const env = toEnv({
      event: 'turn/end',
      usageInputTokens: 120,
      usageOutputTokens: 60,
      usageCacheReadTokens: 500,
      usageCacheWriteTokens: 30,
      usageReasoningTokens: 8,
      timestamp: 'T',
    })
    expect(env.DSH_HOOK_USAGE_INPUT_TOKENS).toBe('120')
    expect(env.DSH_HOOK_USAGE_OUTPUT_TOKENS).toBe('60')
    expect(env.DSH_HOOK_USAGE_CACHE_READ_TOKENS).toBe('500')
    expect(env.DSH_HOOK_USAGE_CACHE_WRITE_TOKENS).toBe('30')
    expect(env.DSH_HOOK_USAGE_REASONING_TOKENS).toBe('8')
  })

  it('omits usage fields when absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_USAGE_INPUT_TOKENS' in env).toBe(false)
    expect('DSH_HOOK_USAGE_OUTPUT_TOKENS' in env).toBe(false)
  })
})

describe('renderTemplate', () => {
  const ctx = { event: 'turn/end', sessionId: 'sess-42', reason: 'completed', durationMs: 500, timestamp: '2026-01-01T00:00:00Z' }

  it('substitutes known placeholders', () => {
    const out = renderTemplate('echo {{DSH_HOOK_SESSION_ID}} {{DSH_HOOK_REASON}}', ctx)
    expect(out).toBe('echo sess-42 completed')
  })

  it('leaves unknown placeholders untouched', () => {
    const out = renderTemplate('echo {{DSH_HOOK_UNKNOWN}}', ctx)
    expect(out).toBe('echo {{DSH_HOOK_UNKNOWN}}')
  })

  it('handles no placeholders', () => {
    expect(renderTemplate('echo plain', ctx)).toBe('echo plain')
  })
})

describe('eventLabel', () => {
  it('labels turn ends with reason and session', () => {
    const label = eventLabel({ event: 'turn/end', sessionId: 's1', reason: 'error', timestamp: 'T' })
    expect(label).toContain('turn/end')
    expect(label).toContain('error')
    expect(label).toContain('s1')
  })

  it('labels sessions by readable name when known', () => {
    const label = eventLabel({ event: 'turn/end', sessionId: 's1', sessionName: '构建脚本', timestamp: 'T' })
    expect(label).toContain('构建脚本')
  })

  it('labels approval with tool', () => {
    const label = eventLabel({ event: 'approval/asked', tool: 'pwsh', timestamp: 'T' })
    expect(label).toContain('pwsh')
  })
})

describe('runningSubagents', () => {
  it('stringifies the running-subagents count on turn/end', () => {
    const env = toEnv({ event: 'turn/end', runningSubagents: 2, timestamp: 'T' })
    expect(env.DSH_HOOK_RUNNING_SUBAGENTS).toBe('2')
  })

  it('carries zero explicitly when provided', () => {
    const env = toEnv({ event: 'turn/end', runningSubagents: 0, timestamp: 'T' })
    expect(env.DSH_HOOK_RUNNING_SUBAGENTS).toBe('0')
  })

  it('omits the variable when the count is absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_RUNNING_SUBAGENTS' in env).toBe(false)
  })
})

describe('session lineage metadata', () => {
  it('maps lineage fields to environment variables', () => {
    const env = toEnv({
      event: 'turn/end',
      parentSessionId: 'parent-1',
      subagent: true,
      delegationDepth: 2,
      sessionCreatedAt: 1750000000000,
      agentPreset: 'liangshen',
      timestamp: 'T',
    })
    expect(env.DSH_HOOK_PARENT_SESSION_ID).toBe('parent-1')
    expect(env.DSH_HOOK_SUBAGENT).toBe('1')
    expect(env.DSH_HOOK_DELEGATION_DEPTH).toBe('2')
    expect(env.DSH_HOOK_SESSION_CREATED_AT).toBe('1750000000000')
    expect(env.DSH_HOOK_AGENT_PRESET).toBe('liangshen')
  })

  it('renders top-level sessions as subagent 0 with depth 0', () => {
    const env = toEnv({ event: 'turn/end', subagent: false, delegationDepth: 0, timestamp: 'T' })
    expect(env.DSH_HOOK_SUBAGENT).toBe('0')
    expect(env.DSH_HOOK_DELEGATION_DEPTH).toBe('0')
  })

  it('omits lineage variables when the fields are absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_PARENT_SESSION_ID' in env).toBe(false)
    expect('DSH_HOOK_SUBAGENT' in env).toBe(false)
    expect('DSH_HOOK_SESSION_CREATED_AT' in env).toBe(false)
  })
})

describe('approval decided fields', () => {
  it('maps approval id and outcome to environment variables', () => {
    const env = toEnv({
      event: 'approval/decided',
      approvalId: 'appr-9',
      approvalOutcome: 'allowed',
      tool: 'pwsh',
      timestamp: 'T',
    })
    expect(env.DSH_HOOK_APPROVAL_ID).toBe('appr-9')
    expect(env.DSH_HOOK_APPROVAL_OUTCOME).toBe('allowed')
    expect(env.DSH_HOOK_TOOL).toBe('pwsh')
  })

  it('omits approval variables when absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_APPROVAL_ID' in env).toBe(false)
    expect('DSH_HOOK_APPROVAL_OUTCOME' in env).toBe(false)
  })
})

describe('tree settled fields', () => {
  it('maps total subagents and tree duration to environment variables', () => {
    const env = toEnv({ event: 'tree/settled', totalSubagents: 3, treeDurationMs: 4200, timestamp: 'T' })
    expect(env.DSH_HOOK_TOTAL_SUBAGENTS).toBe('3')
    expect(env.DSH_HOOK_TREE_DURATION_MS).toBe('4200')
  })

  it('omits the variables when absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_TOTAL_SUBAGENTS' in env).toBe(false)
    expect('DSH_HOOK_TREE_DURATION_MS' in env).toBe(false)
  })
})

describe('hook failed fields', () => {
  it('maps the failing hook identity and count to environment variables', () => {
    const env = toEnv({
      event: 'hook/failed',
      hookFailedHook: 'turn/end: node notify.mjs',
      hookFailures: 3,
      timestamp: 'T',
    })
    expect(env.DSH_HOOK_FAILED_HOOK).toBe('turn/end: node notify.mjs')
    expect(env.DSH_HOOK_FAILURES).toBe('3')
  })

  it('omits the variables when absent', () => {
    const env = toEnv({ event: 'turn/end', timestamp: 'T' })
    expect('DSH_HOOK_FAILED_HOOK' in env).toBe(false)
    expect('DSH_HOOK_FAILURES' in env).toBe(false)
  })
})

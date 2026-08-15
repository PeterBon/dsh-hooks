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

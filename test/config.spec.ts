import { describe, expect, it } from 'vitest'
import { Config, HOOK_EVENTS, TURN_END_REASONS } from '../src/config.js'

describe('Config schema', () => {
  it('accepts an empty hooks list', () => {
    const result = Config({ hooks: [] })
    expect(result.hooks).toEqual([])
  })

  it('defaults hooks to []', () => {
    const result = Config({})
    expect(result.hooks).toEqual([])
  })

  it('accepts a well-formed hook', () => {
    const result = Config({
      hooks: [{ on: 'turn/end', when: 'completed', run: 'echo hi', timeoutMs: 500 }],
    })
    expect(result.hooks).toHaveLength(1)
    expect(result.hooks?.[0]).toMatchObject({
      on: 'turn/end',
      when: 'completed',
      run: 'echo hi',
      timeoutMs: 500,
    })
  })

  it('defaults timeoutMs to 10000', () => {
    const result = Config({ hooks: [{ on: 'turn/start', run: 'echo hi' }] })
    expect(result.hooks?.[0]?.timeoutMs).toBe(10000)
  })

  it('rejects an unknown event type', () => {
    expect(() => Config({ hooks: [{ on: 'tools/pre-execute', run: 'x' }] })).toThrow()
  })

  it('rejects a hook without run', () => {
    expect(() => Config({ hooks: [{ on: 'turn/start' }] })).toThrow()
  })

  it('accepts every known turn/end reason kind as when', () => {
    for (const kind of ['completed', 'error', 'aborted', 'blocked', 'max-tokens', 'interrupted']) {
      const result = Config({ hooks: [{ on: 'turn/end', when: kind, run: 'x' }] })
      expect(result.hooks?.[0]?.when).toBe(kind)
    }
  })

  it('rejects an unknown when value', () => {
    expect(() => Config({ hooks: [{ on: 'turn/end', when: 'compleated' as never, run: 'x' }] })).toThrow()
  })

  it('declares the v1 event surface', () => {
    expect(HOOK_EVENTS).toContain('turn/end')
    expect(HOOK_EVENTS).toContain('approval/asked')
    expect(HOOK_EVENTS).toContain('agent/error')
  })

  it('declares all turn/end reason kinds', () => {
    for (const kind of ['completed', 'error', 'aborted', 'blocked', 'max-tokens', 'interrupted']) {
      expect(TURN_END_REASONS).toContain(kind)
    }
  })
})

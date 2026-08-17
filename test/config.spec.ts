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

  it('accepts a hook without run (run/notify exclusivity is enforced at runtime)', () => {
    const result = Config({ hooks: [{ on: 'turn/start' }] })
    expect(result.hooks).toHaveLength(1)
    expect(result.hooks?.[0]?.run).toBeUndefined()
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

  it('declares the firehose extension events', () => {
    for (const event of ['step/end', 'tool/call', 'tool/result', 'user/message', 'session/title', 'session/created', 'session/disposed']) {
      expect(HOOK_EVENTS).toContain(event)
    }
  })

  it('accepts a hook on every firehose extension event', () => {
    for (const event of ['step/end', 'tool/call', 'tool/result', 'user/message', 'session/title', 'session/created', 'session/disposed']) {
      const result = Config({ hooks: [{ on: event, run: 'x' }] })
      expect(result.hooks?.[0]?.on).toBe(event)
    }
  })

  it('declares all turn/end reason kinds', () => {
    for (const kind of ['completed', 'error', 'aborted', 'blocked', 'max-tokens', 'interrupted']) {
      expect(TURN_END_REASONS).toContain(kind)
    }
  })

  it('compiles match regexes and defaults the execution fields', () => {
    const result = Config({
      hooks: [{ on: 'tool/call', match: { tool: '^pw', sessionName: '构建' }, run: 'x' }],
    })
    expect(result.hooks?.[0]?.match?.tool).toBeInstanceOf(RegExp)
    expect(result.hooks?.[0]?.input).toBe('env')
    expect(result.hooks?.[0]?.retries).toBe(0)
    expect(result.hooks?.[0]?.retryDelayMs).toBe(500)
  })

  it('rejects an invalid match regex', () => {
    expect(() => Config({ hooks: [{ on: 'tool/call', match: { tool: '[' }, run: 'x' }] })).toThrow()
  })

  it('accepts the stdin input mode and rejects unknown modes', () => {
    const result = Config({ hooks: [{ on: 'tool/call', input: 'stdin', run: 'x' }] })
    expect(result.hooks?.[0]?.input).toBe('stdin')
    expect(() => Config({ hooks: [{ on: 'tool/call', input: 'pipe' as never, run: 'x' }] })).toThrow()
  })

  it('accepts retries and retryDelayMs', () => {
    const result = Config({ hooks: [{ on: 'turn/end', retries: 3, retryDelayMs: 1000, run: 'x' }] })
    expect(result.hooks?.[0]).toMatchObject({ retries: 3, retryDelayMs: 1000 })
  })

  it('accepts a built-in webhook notification', () => {
    const result = Config({
      hooks: [{ on: 'turn/end', notify: { channel: 'webhook', url: 'https://hooks.example/x' } }],
    })
    expect(result.hooks?.[0]?.notify).toMatchObject({ channel: 'webhook', url: 'https://hooks.example/x', slack: false })
    expect(result.hooks?.[0]?.run).toBeUndefined()
  })

  it('accepts a desktop notification with defaults', () => {
    const result = Config({ hooks: [{ on: 'approval/asked', notify: { channel: 'desktop' } }] })
    expect(result.hooks?.[0]?.notify).toMatchObject({ channel: 'desktop', slack: false })
  })

  it('rejects unknown notify channels', () => {
    expect(() =>
      Config({ hooks: [{ on: 'turn/end', notify: { channel: 'telegram' as never } }] }),
    ).toThrow()
  })
})

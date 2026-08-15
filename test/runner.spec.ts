import { describe, expect, it, vi, afterEach } from 'vitest'
import { createHookRunner } from '../src/runner.js'

// Mock spawn to avoid real shells in tests.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  }
})

import { spawn } from 'node:child_process'

function fakeChild() {
  const listeners: Record<string, Array<(v?: unknown) => void>> = {}
  return {
    killed: false,
    unref: vi.fn(),
    kill: vi.fn(() => {
      fakeChildRef.killed = true
      return true
    }),
    on: vi.fn((event: string, cb: (v?: unknown) => void) => {
      ;(listeners[event] ??= []).push(cb)
      return fakeChildRef
    }),
    emit(event: string, value?: unknown) {
      for (const cb of listeners[event] ?? []) cb(value)
    },
  }
}
let fakeChildRef: ReturnType<typeof fakeChild>

const spawnMock = vi.mocked(spawn)

afterEach(() => {
  vi.clearAllMocks()
})

describe('createHookRunner', () => {
  it('spawns the rendered command with context env', () => {
    const logs: string[] = []
    const runner = createHookRunner((line) => logs.push(line))
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    const outcome = runner.run(
      { on: 'turn/end', run: 'echo {{DSH_HOOK_SESSION_ID}}' },
      { event: 'turn/end', sessionId: 's1', timestamp: 'T' },
    )

    expect(outcome).toEqual({ ok: true, reason: 'ran' })
    expect(spawnMock).toHaveBeenCalledOnce()
    const [command, options] = spawnMock.mock.calls[0] as [string, { shell: boolean; env: Record<string, string | undefined>; stdio: string }]
    expect(command).toBe('echo s1')
    expect(options.shell).toBe(true)
    expect(options.stdio).toBe('ignore')
    expect(options.env?.DSH_HOOK_SESSION_ID).toBe('s1')
    expect(logs.some((l) => l.includes('turn/end'))).toBe(true)
  })

  it('returns spawn-failed when spawn throws', () => {
    const runner = createHookRunner()
    spawnMock.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const outcome = runner.run({ on: 'agent/error', run: 'x' }, { event: 'agent/error', timestamp: 'T' })
    expect(outcome).toMatchObject({ ok: false, reason: 'spawn-failed' })
  })

  it('kills the child on timeout', () => {
    vi.useFakeTimers()
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x', timeoutMs: 50 }, { event: 'turn/start', timestamp: 'T' })
      vi.advanceTimersByTime(60)
      expect(fakeChildRef.killed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not hold the event loop open (unref called)', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
    expect(fakeChildRef.unref).toHaveBeenCalled()
  })

  it('dispose kills in-flight children', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
    runner.dispose()
    expect(fakeChildRef.killed).toBe(true)
  })
})

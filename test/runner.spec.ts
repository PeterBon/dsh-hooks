import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_RETRY_DELAY_MS, capCaptureText, createHookRunner, retryDelayFor } from '../src/runner.js'

// Mock spawn to avoid real shells in tests.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  }
})

import { spawn } from 'node:child_process'

/** EventEmitter-like fake with registered listener storage and emit(). */
function fakeStream() {
  const listeners: Record<string, Array<(v?: unknown) => void>> = {}
  return {
    on: vi.fn((event: string, cb: (v?: unknown) => void) => {
      ;(listeners[event] ??= []).push(cb)
    }),
    emit(event: string, value?: unknown) {
      for (const cb of listeners[event] ?? []) cb(value)
    },
  }
}

function fakeChild() {
  const listeners: Record<string, Array<(v?: unknown) => void>> = {}
  const child = {
    pid: 12345,
    killed: false,
    stdin: Object.assign(fakeStream(), { write: vi.fn(), end: vi.fn() }),
    stdout: fakeStream(),
    stderr: fakeStream(),
    unref: vi.fn(),
    kill: vi.fn(() => {
      child.killed = true
      return true
    }),
    on: vi.fn((event: string, cb: (v?: unknown) => void) => {
      ;(listeners[event] ??= []).push(cb)
      return child
    }),
    emit(event: string, value?: unknown) {
      for (const cb of listeners[event] ?? []) cb(value)
    },
  }
  return child
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
    const [command, options] = spawnMock.mock.calls[0] as [string, { shell: boolean; env: Record<string, string | undefined>; stdio: unknown }]
    expect(command).toBe('echo s1')
    expect(options.shell).toBe(true)
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe'])
    expect(options.env?.DSH_HOOK_SESSION_ID).toBe('s1')
    expect(logs.some((l) => l.includes('turn/end'))).toBe(true)
  })

  it('writes the full context JSON to stdin in stdin mode', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    runner.run(
      { on: 'turn/end', input: 'stdin', run: 'node consume-stdin.mjs' },
      { event: 'turn/end', sessionId: 's1', turn: 3, timestamp: 'T' },
    )

    const [, options] = spawnMock.mock.calls[0] as [string, { stdio: unknown }]
    expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe'])
    const written = fakeChildRef.stdin.write.mock.calls[0]?.[0]
    expect(JSON.parse(String(written))).toMatchObject({ event: 'turn/end', sessionId: 's1', turn: 3 })
    expect(fakeChildRef.stdin.end).toHaveBeenCalled()
  })

  it('does not write stdin in env mode', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
    expect(fakeChildRef.stdin.write).not.toHaveBeenCalled()
  })

  it('warns with the stderr tail when the command exits non-zero', () => {
    const warns: string[] = []
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((line: string) => warns.push(line))
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
      fakeChildRef.stderr.emit('data', Buffer.from('boom: connection refused'))
      fakeChildRef.emit('close', 3)
      expect(warns.some((l) => l.includes('退出码 3') && l.includes('boom: connection refused'))).toBe(true)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('stays silent on exit code 0', () => {
    const warnSpy = vi.spyOn(console, 'warn')
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
      fakeChildRef.emit('close', 0)
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('retries non-zero exits with exponential backoff up to retries', () => {
    vi.useFakeTimers()
    try {
      const logs: string[] = []
      const runner = createHookRunner((line) => logs.push(line))
      const children: ReturnType<typeof fakeChild>[] = []
      spawnMock.mockImplementation(() => {
        const child = fakeChild()
        children.push(child)
        return child as never
      })
      runner.run(
        { on: 'turn/start', run: 'x', retries: 2, retryDelayMs: 100 },
        { event: 'turn/start', timestamp: 'T' },
      )
      expect(spawnMock).toHaveBeenCalledTimes(1)
      children[0]?.emit('close', 1)
      // First retry waits retryDelayMs.
      expect(spawnMock).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(100)
      expect(spawnMock).toHaveBeenCalledTimes(2)
      children[1]?.emit('close', 1)
      expect(spawnMock).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(200) // doubled delay
      expect(spawnMock).toHaveBeenCalledTimes(3)
      // Retries exhausted: a third failure warns and stops.
      const warnSpy = vi.spyOn(console, 'warn')
      children[2]?.emit('close', 1)
      vi.advanceTimersByTime(1000)
      expect(spawnMock).toHaveBeenCalledTimes(3)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
      expect(logs.some((l) => l.includes('重试（1/2）'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never retries timeouts', () => {
    vi.useFakeTimers()
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x', retries: 3, timeoutMs: 50 }, { event: 'turn/start', timestamp: 'T' })
      vi.advanceTimersByTime(60) // timeout fires, kills the child
      fakeChildRef.emit('close', 1) // close after the kill: must NOT retry
      vi.advanceTimersByTime(10000)
      // The only extra spawn allowed is the Windows taskkill tree kill.
      const hookSpawns = spawnMock.mock.calls.filter(([cmd]) => cmd !== 'taskkill')
      expect(hookSpawns).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('dispose cancels pending retry timers', () => {
    vi.useFakeTimers()
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x', retries: 5, retryDelayMs: 100 }, { event: 'turn/start', timestamp: 'T' })
      fakeChildRef.emit('close', 1)
      runner.dispose()
      vi.advanceTimersByTime(10000)
      expect(spawnMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
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

  it('kills the whole process tree on Windows timeout (shell:true)', () => {
    vi.useFakeTimers()
    try {
      const runner = createHookRunner()
      fakeChildRef = fakeChild()
      spawnMock.mockReturnValue(fakeChildRef as never)
      runner.run({ on: 'turn/start', run: 'x', timeoutMs: 50 }, { event: 'turn/start', timestamp: 'T' })
      vi.advanceTimersByTime(60)
      if (process.platform === 'win32') {
        // The direct child is cmd.exe — taskkill /T must take the tree down.
        const taskkill = spawnMock.mock.calls.find(([cmd]) => cmd === 'taskkill')
        expect(taskkill).toEqual(['taskkill', ['/pid', '12345', '/T', '/F'], { stdio: 'ignore' }])
      }
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

  it('stats reports in-flight children and pending retries', () => {
    const runner = createHookRunner()
    expect(runner.stats()).toEqual({ inFlight: 0, pendingRetries: 0 })
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' })
    expect(runner.stats().inFlight).toBe(1)
    runner.dispose()
    expect(runner.stats().inFlight).toBe(0)
  })

  it('routes outcome records to the per-run override instead of the shared sink', () => {
    const shared: Array<{ outcome: string }> = []
    const overridden: Array<{ outcome: string }> = []
    const runner = createHookRunner(console.log, (record) => shared.push(record))
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    runner.run({ on: 'turn/start', run: 'x' }, { event: 'turn/start', timestamp: 'T' }, (record) => overridden.push(record))
    fakeChildRef.emit('close', 0)

    expect(overridden.map((r) => r.outcome)).toEqual(['spawned', 'exit-0'])
    expect(shared).toHaveLength(0)
  })

  it('threads the override through retried attempts', () => {
    vi.useFakeTimers()
    try {
      const overridden: Array<{ outcome: string }> = []
      const runner = createHookRunner()
      const children: ReturnType<typeof fakeChild>[] = []
      spawnMock.mockImplementation(() => {
        const child = fakeChild()
        children.push(child)
        return child as never
      })

      runner.run(
        { on: 'turn/start', run: 'x', retries: 1, retryDelayMs: 100 },
        { event: 'turn/start', timestamp: 'T' },
        (record) => overridden.push(record),
      )
      children[0]?.emit('close', 1)
      vi.advanceTimersByTime(100)
      children[1]?.emit('close', 0)

      // Intermediate retry attempts record nothing; the final outcome is
      // the logical run's result (failure counting treats one run as one).
      expect(overridden.map((r) => r.outcome)).toEqual(['spawned', 'spawned', 'exit-0'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('spawns in the session cwd when cwd is session', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run(
      { on: 'step/end', run: 'x', cwd: 'session' },
      { event: 'step/end', cwd: 'D:\\work\\demo', timestamp: 'T' },
    )
    const [, options] = spawnMock.mock.calls[0] as [string, { cwd?: string }]
    expect(options.cwd).toBe('D:\\work\\demo')
  })

  it('falls back to the plugin process cwd when the session cwd is unknown', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'step/end', run: 'x', cwd: 'session' }, { event: 'step/end', timestamp: 'T' })
    const [, options] = spawnMock.mock.calls[0] as [string, { cwd?: string }]
    expect(options.cwd).toBe(process.cwd())
  })

  it('spawns in an absolute path cwd verbatim, and leaves cwd unset by default', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'step/end', run: 'x', cwd: 'C:\\tools' }, { event: 'step/end', timestamp: 'T' })
    const [, options] = spawnMock.mock.calls[0] as [string, { cwd?: string }]
    expect(options.cwd).toBe('C:\\tools')

    runner.run({ on: 'step/end', run: 'x' }, { event: 'step/end', timestamp: 'T' })
    const [, plain] = spawnMock.mock.calls[1] as [string, { cwd?: string }]
    expect(plain.cwd).toBeUndefined()
  })

  it('drops runs beyond maxConcurrent and records skipped', () => {
    const records: Array<{ outcome: string }> = []
    const runner = createHookRunner(console.log, (r) => records.push(r))
    const children: ReturnType<typeof fakeChild>[] = []
    spawnMock.mockImplementation(() => {
      const child = fakeChild()
      children.push(child)
      return child as never
    })
    const limiter = { id: 'hook:0', max: 1 }
    const ctx = { event: 'step/end', timestamp: 'T' }
    const spec = { on: 'step/end', run: 'x' }

    expect(runner.run(spec, ctx, (r) => records.push(r), limiter)).toEqual({ ok: true, reason: 'ran' })
    const second: Array<{ outcome: string; error?: string }> = []
    const outcome = runner.run(spec, ctx, (r) => second.push(r), limiter)
    expect(outcome).toMatchObject({ ok: false, reason: 'skipped' })
    expect(second[0]?.outcome).toBe('skipped')
    expect(second[0]?.error).toContain('maxConcurrent')

    // The slot releases when the first logical run reaches a terminal outcome.
    children[0]?.emit('close', 0)
    expect(runner.run(spec, ctx, (r) => records.push(r), limiter)).toEqual({ ok: true, reason: 'ran' })
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the limiter slot occupied across retries', () => {
    vi.useFakeTimers()
    try {
      const runner = createHookRunner()
      const children: ReturnType<typeof fakeChild>[] = []
      spawnMock.mockImplementation(() => {
        const child = fakeChild()
        children.push(child)
        return child as never
      })
      const limiter = { id: 'hook:0', max: 1 }
      const ctx = { event: 'step/end', timestamp: 'T' }
      const spec = { on: 'step/end', run: 'x', retries: 1, retryDelayMs: 100 }

      runner.run(spec, ctx, undefined, limiter)
      children[0]?.emit('close', 1) // retry scheduled — the slot stays held
      expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: false, reason: 'skipped' })
      vi.advanceTimersByTime(100) // retry spawn
      expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: false, reason: 'skipped' })
      children[1]?.emit('close', 0) // logical run finished
      expect(runner.run(spec, ctx, undefined, limiter)).toEqual({ ok: true, reason: 'ran' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('releases the limiter slot when spawn fails', () => {
    const runner = createHookRunner()
    spawnMock.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const limiter = { id: 'hook:0', max: 1 }
    const ctx = { event: 'step/end', timestamp: 'T' }
    const spec = { on: 'step/end', run: 'x' }
    expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: false, reason: 'spawn-failed' })
    expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: false, reason: 'spawn-failed' })
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('clears limiter slots on dispose so a later run is not rejected', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    const limiter = { id: 'hook:0', max: 1 }
    const ctx = { event: 'step/end', timestamp: 'T' }
    const spec = { on: 'step/end', run: 'x' }

    expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: true })
    // The in-flight run still occupies the only slot.
    expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: false })

    // dispose kills the child; its `close` never arrives, so without the
    // teardown reset the slot would stay occupied for the rest of the process.
    runner.dispose()
    expect(runner.stats()).toEqual({ inFlight: 0, pendingRetries: 0 })
    expect(runner.run(spec, ctx, undefined, limiter)).toMatchObject({ ok: true })
  })

  it('hides the console window on Windows', () => {
    const runner = createHookRunner()
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)
    runner.run({ on: 'turn/end', run: 'echo hi' }, { event: 'turn/end', timestamp: 'T' })
    expect(spawnMock).toHaveBeenCalledWith('echo hi', expect.objectContaining({ windowsHide: true }))
  })
})

describe('retry backoff', () => {
  it('doubles per attempt and stops at the ceiling', () => {
    expect(retryDelayFor(500, 0)).toBe(500)
    expect(retryDelayFor(500, 1)).toBe(1000)
    expect(retryDelayFor(500, 3)).toBe(4000)
    // 500 * 2 ** 10 would be 512 s; the cap keeps a logical run short-lived.
    expect(retryDelayFor(500, 10)).toBe(MAX_RETRY_DELAY_MS)
    expect(retryDelayFor(20000, 1)).toBe(MAX_RETRY_DELAY_MS)
  })
})

describe('capture cap', () => {
  it('caps by UTF-8 bytes and never leaves a half-written character', () => {
    // 40k CJK chars are 120 KB of UTF-8 (and only 40k UTF-16 code units).
    const text = capCaptureText('汉'.repeat(40000))
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(64 * 1024)
    expect(text.endsWith('\uFFFD')).toBe(false)
    // The kept prefix is still intact CJK.
    expect(text.startsWith('汉汉')).toBe(true)
    expect(/^汉+$/.test(text)).toBe(true)
  })

  it('keeps short output untouched', () => {
    expect(capCaptureText('全部保留')).toBe('全部保留')
    expect(capCaptureText('汉'.repeat(100), 512)).toBe('汉'.repeat(100))
  })

  it('caps an emoji run without splitting a surrogate pair', () => {
    const text = capCaptureText('😀'.repeat(30000))
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(64 * 1024)
    expect(text.endsWith('\uFFFD')).toBe(false)
    expect(Array.from(text).every((char) => char === '😀')).toBe(true)
  })
})

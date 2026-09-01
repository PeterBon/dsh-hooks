import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, countRunningSubagents, DSH_HOOKS_GUIDANCE } from '../src/index.js'

// Mock spawn so dispatched hooks never launch real shells in tests.
vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
import { spawn } from 'node:child_process'

/** Minimal cordis Context fake: get/on/effect only, services injected. */
function fakeCtx(services: Record<string, unknown> = {}) {
  const listeners = new Map<string, Array<(a?: unknown, b?: unknown) => void>>()
  const effectLabels: string[] = []
  const ctx = {
    get: (name: string) => services[name],
    on: (name: string, cb: (a?: unknown, b?: unknown) => void) => {
      const list = listeners.get(name) ?? []
      list.push(cb)
      listeners.set(name, list)
    },
    effect: (fn: () => unknown, label?: string) => {
      effectLabels.push(label ?? '')
      fn()
      return () => {}
    },
    logger: undefined,
  }
  return { ctx: ctx as unknown as Context, listeners, effectLabels }
}

/** EventEmitter-like fake child with registered listener storage. */
function fakeChild() {
  const listeners: Record<string, Array<(v?: unknown) => void>> = {}
  const child = {
    pid: 12345,
    stdin: {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    },
    stdout: {
      on: vi.fn((event: string, cb: (v?: unknown) => void) => {
        ;(listeners[event] ??= []).push(cb)
      }),
    },
    stderr: {
      on: vi.fn((event: string, cb: (v?: unknown) => void) => {
        ;(listeners[event] ??= []).push(cb)
      }),
    },
    unref: vi.fn(),
    kill: vi.fn(),
    on: vi.fn((event: string, cb: (v?: unknown) => void) => {
      ;(listeners[event] ??= []).push(cb)
      return child
    }),
  }
  return child
}
let fakeChildRef: ReturnType<typeof fakeChild>

const spawnMock = vi.mocked(spawn)

afterEach(() => {
  vi.clearAllMocks()
})

describe('apply soft-dependency wiring', () => {
  it('works without webServer or systemPrompt (CLI/headless)', () => {
    const { ctx, listeners, effectLabels } = fakeCtx()
    expect(() => apply(ctx, { hooks: [] })).not.toThrow()
    expect(listeners.has('session/event')).toBe(true)
    expect(effectLabels).toEqual([''])
  })

  it('registers /dsh-hooks routes when webServer exists', () => {
    const registered: string[] = []
    const webServer = {
      register: (spec: { kind: string; path: string }) => {
        registered.push(`${spec.kind}:${spec.path}`)
        return () => {}
      },
    }
    const { ctx, effectLabels } = fakeCtx({ webServer })
    apply(ctx, { hooks: [] })
    expect(registered).toEqual(['prefix:/dsh-hooks'])
    expect(effectLabels).toContain('dsh-hooks: /dsh-hooks routes')
  })

  it('installs the agent guidance section when systemPrompt exists', () => {
    const sections: { name: string; order?: number; text: string }[] = []
    const systemPrompt = {
      section: (spec: { name: string; order?: number; text: string }) => {
        sections.push(spec)
        return () => {}
      },
    }
    const { ctx, effectLabels } = fakeCtx({ systemPrompt })
    apply(ctx, { hooks: [] })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ name: 'plugin:dsh-hooks', order: 200, text: DSH_HOOKS_GUIDANCE })
    expect(effectLabels).toContain('dsh-hooks: prompt section')
  })

  it('skips both extras when neither service exists', () => {
    const { ctx, effectLabels } = fakeCtx()
    apply(ctx, { hooks: [] })
    expect(effectLabels.filter((l) => l.includes('routes') || l.includes('prompt'))).toEqual([])
  })
})

describe('countRunningSubagents', () => {
  const mk = (id: string, status = 'idle') => ({ id, status })
  const parent = mk('session-main')
  const runningChild = mk('sub-1', 'running')
  const idleChild = mk('sub-2')
  const runningGrandchild = mk('sub-2a', 'running')
  const otherRoot = mk('session-other', 'running')

  const agents = {
    get: (id: string) =>
      ({ 'session-main': parent, 'sub-1': runningChild, 'sub-2': idleChild, 'sub-2a': runningGrandchild, 'session-other': otherRoot })[id],
    list: () => [parent, runningChild, idleChild, runningGrandchild, otherRoot],
    isOwnedBy: () => false,
  }
  const descendants = (rows: Array<{ id: string }>) => ({ listDescendants: async () => rows })

  it('counts running descendants from the durable session tree', async () => {
    await expect(countRunningSubagents(agents, descendants([{ id: 'sub-1' }]), 'session-main')).resolves.toBe(1)
  })

  it('does not count settled or idle children', async () => {
    await expect(countRunningSubagents(agents, descendants([{ id: 'sub-2' }]), 'session-main')).resolves.toBe(0)
  })

  it('counts running grandchildren below an idle child', async () => {
    await expect(countRunningSubagents(agents, descendants([{ id: 'sub-2' }, { id: 'sub-2a' }]), 'session-main')).resolves.toBe(1)
  })

  it('excludes other sessions entirely', async () => {
    await expect(countRunningSubagents(agents, descendants([]), 'session-other')).resolves.toBe(0)
  })

  it('returns 0 for an unknown session', async () => {
    await expect(countRunningSubagents(agents, descendants([{ id: 'sub-1' }]), 'nope')).resolves.toBe(0)
  })

  it('returns 0 when listing throws and the registry scan finds no owner match', async () => {
    const broken = { listDescendants: async () => { throw new Error('boom') } }
    await expect(countRunningSubagents(agents, broken, 'session-main')).resolves.toBe(0)
  })

  it('finds live children through the registry scan when the subagents service is absent', async () => {
    const owned = { ...agents, isOwnedBy: (id: string) => id === 'sub-1' }
    await expect(countRunningSubagents(owned, undefined, 'session-main')).resolves.toBe(1)
  })

  it('finds live children through the registry scan when listing throws', async () => {
    const broken = { listDescendants: async () => { throw new Error('boom') } }
    const owned = { ...agents, isOwnedBy: (id: string) => id === 'sub-1' }
    await expect(countRunningSubagents(owned, broken, 'session-main')).resolves.toBe(1)
  })

  it('does not consult the registry when listing succeeds with no descendants', async () => {
    // A lying registry would claim ownership of sub-1; the successful empty
    // listing must win, keeping ordinary subagent-free turns scan-free.
    const lying = { ...agents, isOwnedBy: () => true }
    await expect(countRunningSubagents(lying, descendants([]), 'session-main')).resolves.toBe(0)
  })
})

describe('turn/end dispatch wiring', () => {
  const sessionObj = { id: 'session-main', header: { cwd: 'C:/tmp' }, events: [] }
  const turnEndEvent = { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }
  const userMessageEvent = { type: 'user/message', data: { content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } } }
  const parent = { id: 'session-main', status: 'idle' }
  const runningChild = { id: 'sub-1', status: 'running' }
  const agents = {
    get: (id: string) => (id === 'session-main' ? parent : id === 'sub-1' ? runningChild : undefined),
    list: () => [parent, runningChild],
    isOwnedBy: () => false,
  }
  const subagents = { listDescendants: async () => [{ id: 'sub-1' }] }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
  const spawnEnv = () => {
    const [, options] = spawnMock.mock.calls[0] as [string, { env: Record<string, string | undefined> }]
    return options.env ?? {}
  }

  function wire(services: Record<string, unknown>, config: Parameters<typeof apply>[1]) {
    const { ctx, listeners } = fakeCtx(services)
    apply(ctx, config)
    const sessionEvent = listeners.get('session/event')
    return { emit: (event: unknown = turnEndEvent) => sessionEvent?.[0]?.(sessionObj, event) }
  }

  it('fills the running-subagent count before dispatching turn/end hooks', async () => {
    const { emit } = wire(
      { agents, subagents },
      { hooks: [{ on: 'turn/end', run: 'node -e ""' }], history: { enabled: false } },
    )
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    emit()
    // Deferred dispatch: nothing may run before the async count resolves.
    expect(spawnMock).not.toHaveBeenCalled()

    await flush()
    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnEnv().DSH_HOOK_RUNNING_SUBAGENTS).toBe('1')
  })

  it('still dispatches (count 0) when the agents service is missing', async () => {
    const { emit } = wire({}, { hooks: [{ on: 'turn/end', run: 'node -e ""' }], history: { enabled: false } })
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    emit()
    await flush()
    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnEnv().DSH_HOOK_RUNNING_SUBAGENTS).toBe('0')
  })

  it('still dispatches (count 0) when the descendant listing throws', async () => {
    const broken = { listDescendants: async () => { throw new Error('boom') } }
    const { emit } = wire(
      { agents, subagents: broken },
      { hooks: [{ on: 'turn/end', run: 'node -e ""' }], history: { enabled: false } },
    )
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    emit()
    await flush()
    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnEnv().DSH_HOOK_RUNNING_SUBAGENTS).toBe('0')
  })

  it('dispatches non-turn/end events synchronously, without the field', async () => {
    const { emit } = wire(
      { agents, subagents },
      { hooks: [{ on: 'user/message', run: 'node -e ""' }], history: { enabled: false } },
    )
    fakeChildRef = fakeChild()
    spawnMock.mockReturnValue(fakeChildRef as never)

    emit(userMessageEvent)
    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnEnv().DSH_HOOK_RUNNING_SUBAGENTS).toBeUndefined()

    await flush()
    expect(spawnMock).toHaveBeenCalledOnce()
  })
})

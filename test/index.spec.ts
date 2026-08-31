import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, countRunningSubagents, DSH_HOOKS_GUIDANCE } from '../src/index.js'

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

  it('falls back to the live-registry scan when listing throws', async () => {
    const broken = { listDescendants: async () => { throw new Error('boom') } }
    await expect(countRunningSubagents(agents, broken, 'session-main')).resolves.toBe(0)
  })
})

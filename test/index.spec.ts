import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, DSH_HOOKS_GUIDANCE } from '../src/index.js'

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

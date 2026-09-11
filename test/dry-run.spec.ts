import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeHook, evaluateHooks, applyMockFields, loadHooks, MOCK_NUMERIC_FIELDS, mockContext, runDryRun } from '../src/dry-run.js'
import type { HookSpec } from '../src/config.js'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-dry-run-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writePatch(hooks: unknown[]) {
  const file = join(tmp, 'cordis.patch.yml')
  writeFileSync(
    file,
    '- id: dsh-hooks\n  name: dsh-hooks\n  config:\n    hooks:\n' +
      hooks
        .map((h) => {
          const spec = h as Record<string, unknown>
          let yaml = `      - on: ${JSON.stringify(spec.on)}`
          if (spec.when) yaml += `\n        when: ${JSON.stringify(spec.when)}`
          if (spec.run) yaml += `\n        run: ${JSON.stringify(spec.run)}`
          if (spec.match) {
            // Flow style keeps the helper tiny; YAML accepts JSON here.
            const entries = Object.entries(spec.match as Record<string, unknown>)
              .map(([key, value]) => `\n          ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
              .join('')
            yaml += `\n        match:${entries}`
          }
          if (spec.notify) {
            yaml += `\n        notify:\n          channel: ${spec.notify.channel}`
            if (spec.notify.url) yaml += `\n          url: ${spec.notify.url}`
          }
          return yaml
        })
        .join('\n') +
      '\n',
    'utf8',
  )
  return file
}

describe('loadHooks', () => {
  it('extracts and normalizes the dsh-hooks block', () => {
    const file = writePatch([{ on: 'turn/end', when: 'completed', run: 'echo hi' }])
    const { hooks, source } = loadHooks('web', { patchFile: file })
    expect(source).toBe(file)
    expect(hooks).toHaveLength(1)
    expect(hooks[0]).toMatchObject({ on: 'turn/end', when: 'completed', run: 'echo hi', timeoutMs: 10000 })
  })

  it('throws when the patch file is missing or has no dsh-hooks block', () => {
    expect(() => loadHooks('web', { patchFile: join(tmp, 'missing.yml') })).toThrow('未找到')
    const other = join(tmp, 'other.yml')
    writeFileSync(other, '- id: something-else\n  name: x\n', 'utf8')
    expect(() => loadHooks('web', { patchFile: other })).toThrow('没有 id: dsh-hooks')
  })

  it('throws on invalid config (bad regex)', () => {
    const patch = join(tmp, 'bad.yml')
    writeFileSync(
      patch,
      '- id: dsh-hooks\n  name: dsh-hooks\n  config:\n    hooks:\n      - on: tool/call\n        match:\n          tool: "["\n        run: x\n',
      'utf8',
    )
    expect(() => loadHooks('web', { patchFile: patch })).toThrow()
  })
})

describe('mockContext', () => {
  it('builds a synthetic context with overrides', () => {
    const ctx = mockContext('turn/end', { reason: 'completed', sessionName: '自定义' })
    expect(ctx).toMatchObject({
      event: 'turn/end',
      reason: 'completed',
      sessionName: '自定义',
      sessionId: 'dry-run',
      turn: 1,
    })
  })
})

describe('evaluateHooks', () => {
  const hooks = [
    { on: 'turn/end', when: 'completed', run: 'node a.mjs' },
    { on: 'turn/end', when: 'error', run: 'node b.mjs' },
    { on: 'tool/call', run: 'node c.mjs' },
    { on: 'tool/call', match: { tool: /^ssh/ }, run: 'node d.mjs' },
  ] as HookSpec[]
  const ctx = mockContext('turn/end', { reason: 'completed' })

  it('marks matching hooks and explains the skipped ones', () => {
    const lines = evaluateHooks(hooks, 'turn/end', ctx, 'completed')
    expect(lines.map((l) => l.matched)).toEqual([true, false, false, false])
    expect(lines[0].why).toBe('')
    expect(lines[1].why).toContain('completed')
    expect(lines[2].why).toContain('事件不匹配')
    expect(lines[3].why).toContain('事件不匹配')
  })

  it('applies match filters to matching events', () => {
    const toolCtx = mockContext('tool/call', { tool: 'ssh_exec' })
    const lines = evaluateHooks(hooks, 'tool/call', toolCtx)
    expect(lines.map((l) => l.matched)).toEqual([false, false, true, true])
    const nonSsh = mockContext('tool/call', { tool: 'read' })
    expect(evaluateHooks(hooks, 'tool/call', nonSsh).map((l) => l.matched)).toEqual([false, false, true, false])
  })

  it('explains enabled: false hooks', () => {
    const disabled = [{ on: 'turn/end', run: 'x', enabled: false }] as HookSpec[]
    const lines = evaluateHooks(disabled, 'turn/end', ctx, 'completed')
    expect(lines[0].matched).toBe(false)
    expect(lines[0].why).toContain('enabled: false')
  })

  it('evaluates numeric match filters in dry-run', () => {
    const numeric = [{ on: 'tool/result', match: { toolDurationMs: { gt: 10000 } }, run: 'x' }] as HookSpec[]
    expect(evaluateHooks(numeric, 'tool/result', mockContext('tool/result', { toolDurationMs: 15000 }))[0].matched).toBe(true)
    expect(evaluateHooks(numeric, 'tool/result', mockContext('tool/result', { toolDurationMs: 500 }))[0].matched).toBe(false)
  })
})

describe('describeHook', () => {
  it('renders run, notify, when, and match', () => {
    expect(describeHook({ on: 'turn/end', when: 'completed', run: 'echo hi' })).toBe('[turn/end when=completed] run: echo hi')
    expect(describeHook({ on: 'approval/asked', notify: { channel: 'desktop' } })).toBe('[approval/asked] notify: desktop')
    expect(describeHook({ on: 'tool/call', match: { tool: /^pw/ }, run: 'x' })).toContain('"tool":"^pw"')
  })

  it('renders execution options and numeric match values', () => {
    const summary = describeHook({ on: 'step/end', run: 'x', cwd: 'session', maxConcurrent: 2, debounceMs: 250 })
    expect(summary).toContain('cwd:session')
    expect(summary).toContain('maxConcurrent:2')
    expect(summary).toContain('debounceMs:250')
    expect(describeHook({ on: 'step/end', run: 'x', enabled: false })).toContain('enabled:false')
    expect(describeHook({ on: 'tool/result', match: { toolDurationMs: { gt: 10000 } }, run: 'x' })).toContain('"toolDurationMs":"{\\"gt\\":10000}"')
    expect(describeHook({ on: 'tool/result', match: { toolDurationMs: />10000/ }, run: 'x' })).toContain('">10000"')
  })
})

describe('runDryRun', () => {
  it('prints a report and never executes without --execute', async () => {
    const file = writePatch([
      { on: 'turn/end', when: 'completed', run: 'echo hi' },
      { on: 'tool/call', run: 'echo x' },
    ])
    const lines: string[] = []
    const result = await runDryRun({
      profile: 'web',
      event: 'turn/end',
      reason: 'completed',
      paths: { patchFile: file },
      print: (l) => lines.push(l),
    })
    expect(result).toEqual({ matched: 1, total: 2 })
    const text = lines.join('\n')
    expect(text).toContain('✅ [1]')
    expect(text).toContain('⏭ [2]')
    expect(text).toContain('--execute')
  })

  it('simulates numeric fields so count-based matches become reachable', async () => {
    const file = writePatch([
      { on: 'turn/end', match: { runningSubagents: '^0$' }, run: 'echo idle' },
      { on: 'turn/end', match: { runningSubagents: { gt: 0 } }, run: 'echo busy' },
    ])
    const idleLines: string[] = []
    const idle = await runDryRun({
      profile: 'web',
      event: 'turn/end',
      paths: { patchFile: file },
      print: (l) => idleLines.push(l),
    })
    // The turn/end mock carries the count the runtime always provides (0),
    // so the documented `runningSubagents: '^0$'` pattern is reachable again.
    expect(idle.matched).toBe(1)
    expect(idleLines.join('\n')).toContain('✅ [1]')

    const busyLines: string[] = []
    const busy = await runDryRun({
      profile: 'web',
      event: 'turn/end',
      fields: { runningSubagents: 3 },
      paths: { patchFile: file },
      print: (l) => busyLines.push(l),
    })
    expect(busy.matched).toBe(1)
    expect(busyLines.join('\n')).toContain('模拟字段：runningSubagents=3')
    expect(busyLines.join('\n')).toContain('✅ [2]')
  })

  it('names fields it cannot simulate instead of dropping them silently', async () => {
    const file = writePatch([{ on: 'turn/end', run: 'echo hi' }])
    const lines: string[] = []
    await runDryRun({
      profile: 'web',
      event: 'turn/end',
      fields: { nope: 1, durationMs: 'soon', turn: 7 },
      paths: { patchFile: file },
      print: (l) => lines.push(l),
    })
    const text = lines.join('\n')
    expect(text).toContain('已忽略无法模拟的字段：nope, durationMs')
    expect(text).toContain('模拟字段：turn=7')
  })
})

describe('applyMockFields', () => {
  it('applies finite numbers for whitelisted fields only', () => {
    const { ctx, ignored } = applyMockFields(mockContext('turn/end'), { turn: 4, durationMs: 900, nope: 1 })
    expect(ctx.turn).toBe(4)
    expect(ctx.durationMs).toBe(900)
    expect(ignored).toEqual(['nope'])
  })

  it('rejects non-finite and non-numeric values', () => {
    const { ctx, ignored } = applyMockFields(mockContext('tool/result'), {
      durationMs: Number.NaN,
      runningSubagents: '2',
      usageInputTokens: Number.POSITIVE_INFINITY,
    })
    expect(ignored).toEqual(['durationMs', 'runningSubagents', 'usageInputTokens'])
    expect(ctx.durationMs).toBeUndefined()
    expect(ctx.usageInputTokens).toBeUndefined()
  })

  it('returns the context untouched without fields, and never mutates the input', () => {
    const base = mockContext('turn/end')
    expect(applyMockFields(base, undefined)).toEqual({ ctx: base, ignored: [] })
    applyMockFields(base, { turn: 9 })
    expect(base.turn).toBe(1)
  })
})

describe('mockContext field presence', () => {
  it('carries the always-present turn/end fields', () => {
    expect(mockContext('turn/end').runningSubagents).toBe(0)
    expect(mockContext('step/end').runningSubagents).toBeUndefined()
  })

  it('exposes a documented whitelist of simulatable fields', () => {
    for (const field of ['runningSubagents', 'durationMs', 'usageInputTokens', 'usageOutputTokens']) {
      expect(MOCK_NUMERIC_FIELDS).toContain(field)
    }
  })
})

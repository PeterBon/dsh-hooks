import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  patchTextWithHooks,
  removeScriptHooks,
  validateHookWire,
  writeHooksConfig,
  type HookWireSpec,
} from '../src/patch-config.js'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-patch-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const runHook: HookWireSpec = { on: 'turn/end', when: 'completed', run: 'node notify.mjs' }
const notifyHook: HookWireSpec = {
  on: 'approval/asked',
  notify: { channel: 'desktop' },
}
const matchHook: HookWireSpec = {
  on: 'tool/call',
  match: { tool: '^(rm|git|ssh)' },
  run: 'node alert.mjs',
  retries: 2,
}

describe('validateHookWire', () => {
  it('accepts valid hooks', () => {
    expect(validateHookWire([runHook, notifyHook, matchHook])).toBeNull()
  })

  it('rejects unknown events and reasons', () => {
    expect(validateHookWire([{ on: 'nope', run: 'x' }])).toContain('无效事件')
    expect(validateHookWire([{ on: 'turn/end', when: 'maybe', run: 'x' }])).toContain('无效 when')
  })

  it('rejects invalid regexes', () => {
    expect(validateHookWire([{ on: 'tool/call', match: { tool: '([' }, run: 'x' }])).toContain('正则无效')
    expect(validateHookWire([{ on: 'tool/call', match: { '': 'x' }, run: 'x' }])).toContain('字段名不能为空')
  })

  it('requires exactly one of run and notify', () => {
    expect(validateHookWire([{ on: 'turn/end' }])).toContain('必须且只能')
    expect(validateHookWire([{ on: 'turn/end', run: 'x', notify: { channel: 'desktop' } }])).toContain('必须且只能')
    expect(validateHookWire([{ on: 'turn/end', run: '  ', notify: null }])).toContain('必须且只能')
  })

  it('rejects negative numeric fields', () => {
    expect(validateHookWire([{ ...runHook, timeoutMs: -1 }])).toContain('timeoutMs')
    expect(validateHookWire([{ ...runHook, retries: Number.NaN }])).toContain('retries')
  })

  it('accepts and validates the per-hook execution options', () => {
    expect(
      validateHookWire([{ ...runHook, enabled: false, cwd: 'session', maxConcurrent: 2, debounceMs: 100 }]),
    ).toBeNull()
    expect(validateHookWire([{ ...runHook, cwd: 'D:\\work\\demo' }])).toBeNull()
    expect(validateHookWire([{ ...runHook, maxConcurrent: -1 }])).toContain('maxConcurrent')
    expect(validateHookWire([{ ...runHook, debounceMs: -5 }])).toContain('debounceMs')
    expect(validateHookWire([{ ...runHook, cwd: 'relative/path' }])).toContain('cwd')
  })

  it('accepts comparison string match values', () => {
    expect(validateHookWire([{ on: 'tool/result', match: { toolDurationMs: '>10000' }, run: 'x' }])).toBeNull()
  })
})

describe('patchTextWithHooks', () => {
  it('appends a dsh-hooks block to an empty patch list', () => {
    const out = patchTextWithHooks('[]\n', [runHook])
    expect(out).toContain('id: dsh-hooks')
    expect(out).toContain('- on: turn/end')
    expect(out).toContain('run: node notify.mjs')
  })

  it('replaces hooks while keeping other config and entries', () => {
    const existing = [
      '- id: other',
      '  config: { keep: true }',
      '- id: dsh-hooks',
      '  name: dsh-hooks',
      '  config:',
      '    history: { max: 50 }',
      '    hooks:',
      "      - on: 'turn/start'",
      "        run: 'echo old'",
    ].join('\n')
    const out = patchTextWithHooks(existing, [notifyHook, matchHook])
    expect(out).toContain('keep: true')
    expect(out).toContain('max: 50') // history config preserved
    expect(out).not.toContain('echo old')
    expect(out).toContain('approval/asked')
    expect(out).toContain('channel: desktop')
    expect(out).toContain('tool: ^(rm|git|ssh)')
    expect(out.match(/id: dsh-hooks/g)).toHaveLength(1)
  })

  it('rejects a non-array top level', () => {
    expect(() => patchTextWithHooks('a: 1\n', [runHook])).toThrow('必须是 YAML 数组')
  })
})

describe('writeHooksConfig', () => {
  it('writes the file with a timestamped backup', () => {
    const patchFile = join(tmp, 'cordis.patch.yml')
    writeFileSync(patchFile, '- id: other\n  config: { keep: true }\n', 'utf8')
    const result = writeHooksConfig(patchFile, [runHook])
    expect(result.hookCount).toBe(1)
    expect(result.backupPath).toMatch(/cordis\.patch\.yml\.bak-\d{8}-\d{6}$/)
    expect(existsSync(result.backupPath)).toBe(true)
    expect(readFileSync(result.backupPath, 'utf8')).toContain('keep: true')
    const saved = readFileSync(patchFile, 'utf8')
    expect(saved).toContain('keep: true')
    expect(saved).toContain('node notify.mjs')
  })

  it('refuses to write invalid hooks', () => {
    const patchFile = join(tmp, 'cordis.patch.yml')
    expect(() => writeHooksConfig(patchFile, [{ on: 'x', run: 'y' }])).toThrow('无效事件')
    expect(existsSync(patchFile)).toBe(false)
  })
})

describe('removeScriptHooks', () => {
  it('drops only hooks referencing the script, with a backup', () => {
    const patchFile = join(tmp, 'cordis.patch.yml')
    writeFileSync(
      patchFile,
      [
        '- id: dsh-hooks',
        '  config:',
        '    hooks:',
        "      - { on: 'turn/end', when: 'completed', run: 'node C:/x/notify-feishu.mjs' }",
        "      - { on: 'turn/end', when: 'error', run: 'node C:/x/notify-feishu.mjs' }",
        "      - { on: 'tool/call', run: 'echo keep' }",
      ].join('\n'),
      'utf8',
    )
    removeScriptHooks(patchFile, 'notify-feishu.mjs')
    const saved = readFileSync(patchFile, 'utf8')
    expect(saved).not.toContain('notify-feishu.mjs')
    expect(saved).toContain('echo keep')
    // A backup beside the file holds the previous content.
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const bak = readdirSync(tmp).find((name) => name.includes('.bak-'))
    expect(bak).toBeDefined()
  })

  it('is a no-op when the patch file does not exist', () => {
    expect(() => removeScriptHooks(join(tmp, 'missing.yml'), 'notify-feishu.mjs')).not.toThrow()
  })
})

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The setup flow sends a welcome card; never hit the network in tests.
vi.mock('../examples/notify-feishu.mjs', () => ({
  run: vi.fn(async () => ({ kind: 'card' })),
}))

import {
  FEISHU_RESULT_MAX_CHARS_DEFAULT,
  readFeishuSummary,
  runFeishuSetup,
  updateFeishuResultMaxChars,
} from '../src/feishu.js'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-feishu-config-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const credentials = {
  app_id: 'cli_abc123',
  app_secret: 'secret',
  target_type: 'open_id',
  target_id: 'ou_xyz',
}

describe('readFeishuSummary.resultMaxChars', () => {
  it('defaults to 300 when no credential file exists', () => {
    const summary = readFeishuSummary(join(tmp, 'missing.json'))
    expect(summary.resultMaxChars).toBe(FEISHU_RESULT_MAX_CHARS_DEFAULT)
    expect(summary.configured).toBe(false)
  })

  it('reads the stored truncation length (floored)', () => {
    const file = join(tmp, 'feishu-config.json')
    writeFileSync(file, JSON.stringify({ ...credentials, result_max_chars: 1234.9 }), 'utf8')
    const summary = readFeishuSummary(file)
    expect(summary.configured).toBe(true)
    expect(summary.resultMaxChars).toBe(1234)
  })

  it('falls back to 300 for invalid stored values', () => {
    const file = join(tmp, 'feishu-config.json')
    writeFileSync(file, JSON.stringify({ ...credentials, result_max_chars: 'wide' }), 'utf8')
    expect(readFeishuSummary(file).resultMaxChars).toBe(300)
  })
})

describe('updateFeishuResultMaxChars', () => {
  it('writes the floored value and keeps every other field', () => {
    const file = join(tmp, 'feishu-config.json')
    writeFileSync(file, JSON.stringify(credentials, null, 2), 'utf8')
    expect(updateFeishuResultMaxChars(file, 1234.9)).toBe(1234)
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    expect(saved).toMatchObject({ ...credentials, result_max_chars: 1234 })
  })

  it('rejects values outside the 50–5000 range', () => {
    const file = join(tmp, 'feishu-config.json')
    writeFileSync(file, JSON.stringify(credentials), 'utf8')
    expect(() => updateFeishuResultMaxChars(file, 10)).toThrow('50–5000')
    expect(() => updateFeishuResultMaxChars(file, 99999)).toThrow('50–5000')
    expect(() => updateFeishuResultMaxChars(file, Number.NaN)).toThrow('50–5000')
  })

  it('rejects a missing or unparsable credential file', () => {
    expect(() => updateFeishuResultMaxChars(join(tmp, 'missing.json'), 300)).toThrow('尚未连接飞书')
    const broken = join(tmp, 'broken.json')
    writeFileSync(broken, '{not json', 'utf8')
    expect(() => updateFeishuResultMaxChars(broken, 300)).toThrow('解析失败')
  })
})

describe('runFeishuSetup resultMaxChars', () => {
  it('writes the requested truncation length into the credential file', async () => {
    const configPath = join(tmp, 'feishu-config.json')
    const patchFile = join(tmp, 'cordis.patch.yml')
    const registerMock = vi.fn(async () => ({
      client_id: 'cli_new',
      client_secret: 'secret_new',
      user_info: { open_id: 'ou_owner' },
    }))
    await runFeishuSetup({
      registerAppFn: registerMock,
      print: () => undefined,
      printErr: () => undefined,
      resultMaxChars: 800,
      paths: { configPath, patchFile, notifyScript: join(tmp, 'notify.mjs') },
    })
    expect(JSON.parse(readFileSync(configPath, 'utf8')).result_max_chars).toBe(800)
    expect(existsSync(patchFile)).toBe(true)
  })
})

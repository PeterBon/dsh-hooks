import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the notify pipeline so setup tests never hit the network.
vi.mock('../examples/notify-feishu.mjs', () => ({
  run: vi.fn(async () => ({ kind: 'card' })),
}))

import { mergePatchYaml, notifyScriptPath, setupFeishu, setupHooks } from '../bin/dsh-hooks.mjs'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-setup-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe('setupHooks / notifyScriptPath', () => {
  it('declares the card hooks for turn/approval/agent events', () => {
    const hooks = setupHooks('C:\\x\\notify-feishu.mjs')
    expect(hooks.map((h) => `${h.on}${h.when ?? ''}`)).toEqual([
      'turn/endcompleted',
      'turn/enderror',
      'turn/endaborted',
      'approval/asked',
      'agent/error',
    ])
    expect(hooks[0].run).toContain('notify-feishu.mjs')
    expect(hooks[3].run).toContain('--approval')
  })

  it('notifyScriptPath points at the shipped example', () => {
    expect(notifyScriptPath().replace(/\\/g, '/')).toMatch(/examples\/notify-feishu\.mjs$/)
  })
})

describe('mergePatchYaml', () => {
  it('inserts a dsh-hooks entry into an empty patch list', () => {
    const out = mergePatchYaml('[]\n', { scriptPath: 'C:\\x\\notify-feishu.mjs' })
    expect(out).toContain('id: dsh-hooks')
    expect(out).toContain('name: dsh-hooks')
    expect(out).toContain('- on: turn/end')
    expect(out).toContain('approval/asked')
  })

  it('preserves other entries and replaces the dsh-hooks config', () => {
    const existing = [
      '- id: other-plugin',
      '  name: other-plugin',
      '  config:',
      '    keep: true',
      '- id: dsh-hooks',
      '  name: dsh-hooks',
      '  config:',
      '    hooks:',
      "      - on: 'turn/start'",
      "        run: 'echo old'",
    ].join('\n')
    const out = mergePatchYaml(existing, { scriptPath: 'X' })
    expect(out).toContain('other-plugin')
    expect(out).toContain('keep: true')
    expect(out).not.toContain('echo old')
    expect(out).toContain('approval/asked')
    // Exactly one dsh-hooks entry survives.
    expect(out.match(/id: dsh-hooks/g)).toHaveLength(1)
  })

  it('rejects a non-array top level', () => {
    expect(() => mergePatchYaml('a: 1\n', { scriptPath: 'X' })).toThrow('必须是 YAML 数组')
  })
})

describe('setupFeishu', () => {
  it('registers via registerApp, writes config + patch, sends welcome card', async () => {
    const configPath = join(tmp, 'feishu-config.json')
    const patchFile = join(tmp, 'cordis.patch.yml')
    const registerMock = vi.fn(async () => ({
      client_id: 'cli_test123',
      client_secret: 'secret_xyz',
      user_info: { open_id: 'ou_owner' },
    }))
    const prints: string[] = []
    const errors: string[] = []

    const result = await setupFeishu({
      profile: 'web',
      registerAppFn: registerMock,
      print: (s) => prints.push(String(s)),
      printErr: (s) => errors.push(String(s)),
      openUrl: async () => undefined,
      paths: { configPath, patchFile, notifyScript: 'C:\\x\\notify-feishu.mjs' },
    })

    expect(result).toEqual({ appId: 'cli_test123', ownerOpenId: 'ou_owner' })
    expect(registerMock).toHaveBeenCalledOnce()
    const options = registerMock.mock.calls[0][0]
    expect(options.createOnly).toBe(true)
    expect(options.addons.scopes.tenant).toEqual(['im:message:send_as_bot'])

    const file = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(file).toMatchObject({
      app_id: 'cli_test123',
      app_secret: 'secret_xyz',
      target_type: 'open_id',
      target_id: 'ou_owner',
      result_max_chars: 300,
    })

    const patch = readFileSync(patchFile, 'utf8')
    expect(patch).toContain('dsh-hooks')
    expect(patch).toContain('approval/asked')
    expect(prints.join('\n')).toContain('1/4')
    expect(prints.join('\n')).toContain('欢迎卡片已发送')
  })

  it('surfaces registerApp failures', async () => {
    await expect(
      setupFeishu({
        registerAppFn: async () => {
          throw new Error('扫码超时')
        },
        print: () => undefined,
        printErr: () => undefined,
        paths: { configPath: join(tmp, 'c.json'), patchFile: join(tmp, 'p.yml') },
      }),
    ).rejects.toThrow('扫码超时')
  })

  it('rejects results without open_id', async () => {
    await expect(
      setupFeishu({
        registerAppFn: async () => ({ client_id: 'cli_x', client_secret: 's' }),
        print: () => undefined,
        printErr: () => undefined,
        paths: { configPath: join(tmp, 'c.json'), patchFile: join(tmp, 'p.yml') },
      }),
    ).rejects.toThrow('open_id')
  })
})

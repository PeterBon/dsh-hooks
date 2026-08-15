#!/usr/bin/env node
/**
 * dsh-hooks CLI — Feishu notification setup, zero manual app creation.
 *
 * Commands:
 *   dsh-hooks feishu-setup [--profile <name>]   scan a QR code to create a
 *                                               Feishu bot app automatically
 *                                               (official registerApp flow),
 *                                               write credentials + hook
 *                                               config, then send a welcome
 *                                               card to the scanning user.
 *   dsh-hooks feishu-test                      verify credentials and send a
 *                                               test card to the configured
 *                                               target.
 *
 * The setup writes:
 *   ~/.dsh/dsh-hooks/feishu-config.json        app_id/app_secret/target (0600)
 *   ~/.dsh/profiles/<name>/cordis.patch.yml    dsh-hooks config block with
 *                                              turn/end + approval/asked +
 *                                              agent/error card hooks
 *
 * Requires Node >= 22. Dependencies: @larksuiteoapi/node-sdk (registerApp),
 * qrcode (terminal QR), yaml (patch merge). Credentials never enter argv or
 * the environment beyond the setup process itself.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { registerApp } from '@larksuiteoapi/node-sdk'
import QRCode from 'qrcode'
import YAML from 'yaml'
import { run as notifyRun } from '../examples/notify-feishu.mjs'

const CONFIG_DIR = join(homedir(), '.dsh', 'dsh-hooks')
export const CONFIG_PATH = join(CONFIG_DIR, 'feishu-config.json')

/** Profile patch file for a profile name. */
export function patchPath(profile) {
  return join(homedir(), '.dsh', 'profiles', profile, 'cordis.patch.yml')
}

/** Which hooks the setup installs into the profile. */
export function setupHooks(scriptPath) {
  return [
    { on: 'turn/end', when: 'completed', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
    { on: 'turn/end', when: 'error', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
    { on: 'turn/end', when: 'aborted', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
    { on: 'approval/asked', run: `node ${JSON.stringify(scriptPath)} --approval`, timeoutMs: 30000 },
    { on: 'agent/error', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
  ]
}

/** Absolute path of the shipped notify script. */
export function notifyScriptPath() {
  return new URL('../examples/notify-feishu.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
}

/**
 * Write the credential file with 0600 perms (owner-only), matching the
 * feishu-notify security posture: secrets stay out of the repo and argv.
 */
export function writeConfig(configPath, { appId, appSecret, targetType = 'open_id', targetId, resultMaxChars = 300 }) {
  mkdirSync(join(configPath, '..'), { recursive: true, mode: 0o700 })
  const doc = JSON.stringify(
    {
      app_id: appId,
      app_secret: appSecret,
      target_type: targetType,
      target_id: targetId,
      result_max_chars: resultMaxChars,
    },
    null,
    2,
  )
  writeFileSync(configPath, doc + '\n', 'utf8')
  try {
    chmodSync(configPath, 0o600)
  } catch {
    // Windows: ACL-based protection; the file lives under the user profile.
  }
}

/**
 * Merge the dsh-hooks config block into a profile's cordis.patch.yml:
 * existing dsh-hooks entries keep unrelated config and get their hooks
 * replaced with `setupHooks`; other entries stay untouched. Idempotent.
 */
export function mergePatchYaml(existingText, { scriptPath }) {
  let entries
  try {
    entries = YAML.parse(existingText || '[]\n')
  } catch {
    throw new Error('profile 的 cordis.patch.yml 解析失败，请先修复该文件')
  }
  if (!Array.isArray(entries)) throw new Error('cordis.patch.yml 顶层必须是 YAML 数组')

  const hooks = setupHooks(scriptPath)
  let found = false
  for (const entry of entries) {
    if (entry && typeof entry === 'object' && entry.id === 'dsh-hooks') {
      entry.name = 'dsh-hooks'
      entry.config = { hooks }
      found = true
      break
    }
  }
  if (!found) entries.push({ id: 'dsh-hooks', name: 'dsh-hooks', config: { hooks } })
  return YAML.stringify(entries)
}

/**
 * Full setup flow. `deps` is injectable for tests:
 *   registerAppFn — the official registerApp (default)
 *   print/printErr — output sinks
 *   openUrl — browser opener (no-op by default in tests)
 *   paths — { configPath, patchFile, notifyScript }
 * Returns the created app facts (without the secret in logs).
 */
export async function setupFeishu({
  profile = 'web',
  registerAppFn = registerApp,
  print = console.log,
  printErr = console.error,
  openUrl = () => undefined,
  paths = {},
} = {}) {
  const configPath = paths.configPath ?? CONFIG_PATH
  const patchFile = paths.patchFile ?? patchPath(profile)
  const notifyScript = paths.notifyScript ?? notifyScriptPath()

  print('dsh-hooks feishu-setup')
  print('1/4 正在生成飞书「一键创建应用」二维码…')

  const result = await registerAppFn({
    source: 'dsh-hooks',
    createOnly: true,
    appPreset: {
      name: 'DSH 通知机器人',
      desc: 'DeepSeek Harness 会话事件通知（dsh-hooks）',
    },
    addons: {
      preset: false,
      scopes: {
        tenant: ['im:message:send_as_bot'],
      },
    },
    onQRCodeReady: (authorization) => {
      print('')
      print(`请用飞书扫码（${authorization.expireIn} 秒内有效），或在浏览器打开：`)
      print(authorization.url)
      try {
        QRCode.toString(authorization.url, { type: 'terminal', small: true }, (err, qr) => {
          if (!err) print(qr)
        })
      } catch {
        // Terminal QR is best-effort; the URL above always works.
      }
      void openUrl(authorization.url).catch(() => undefined)
    },
  })

  const appId = result.client_id
  const appSecret = result.client_secret
  const ownerOpenId = result.user_info?.open_id
  if (!appId || !appSecret) throw new Error('扫码创建未完成，未拿到应用凭证')
  if (!ownerOpenId) throw new Error('扫码结果缺少 open_id，请重试')

  print('')
  print(`2/4 应用创建成功：${appId}（机器人将私聊通知你）`)

  writeConfig(configPath, {
    appId,
    appSecret,
    targetType: 'open_id',
    targetId: ownerOpenId,
    resultMaxChars: 300,
  })
  print(`3/4 凭据已写入 ${configPath}（权限 0600，勿提交到仓库）`)

  const existing = existsSync(patchFile) ? readFileSync(patchFile, 'utf8') : '[]\n'
  const merged = mergePatchYaml(existing, { scriptPath: notifyScript })
  writeFileSync(patchFile, merged, 'utf8')
  print(`4/4 hook 配置已写入 ${patchFile}`)

  print('发送欢迎卡片验证…')
  try {
    await notifyRun({
      appId,
      appSecret,
      to: ownerOpenId,
      event: 'agent/created',
      sessionId: 'dsh-hooks-setup',
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
    })
    print('✅ 欢迎卡片已发送。请重启 dsh web 使 hooks 生效。')
  } catch (error) {
    printErr(`⚠ 欢迎卡片发送失败（配置已就绪，可稍后用 feishu-test 重试）：${error instanceof Error ? error.message : String(error)}`)
  }

  return { appId, ownerOpenId }
}

/** Test credentials and send a test card to the configured target. */
export async function testFeishu({ print = console.log, printErr = console.error, paths = {} } = {}) {
  const configPath = paths.configPath ?? CONFIG_PATH
  if (!existsSync(configPath)) {
    printErr(`未找到配置文件 ${configPath}，请先运行 feishu-setup`)
    process.exit(1)
  }
  const file = JSON.parse(readFileSync(configPath, 'utf8'))
  if (!file.app_id || !file.app_secret || !file.target_id) {
    printErr('配置文件不完整，请重新运行 feishu-setup')
    process.exit(1)
  }
  await notifyRun({
    appId: file.app_id,
    appSecret: file.app_secret,
    to: file.target_id,
    event: 'agent/status',
    status: 'connected',
    sessionId: 'feishu-test',
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  })
  print('✅ 测试卡片已发送')
}

const [, , command, ...args] = process.argv

function cliArgs(args) {
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile') opts.profile = args[++i]
  }
  return opts
}

function isDirectRun() {
  try {
    return process.argv[1] !== undefined && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
  } catch {
    return false
  }
}

function runCli() {
  if (command === 'feishu-setup') {
    const { profile } = cliArgs(args)
    setupFeishu({ profile: profile ?? 'web' })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  } else if (command === 'feishu-test') {
    testFeishu()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  } else {
    console.error(`用法:
  dsh-hooks feishu-setup [--profile <name>]   扫码创建飞书通知机器人并自动配置
  dsh-hooks feishu-test                       验证配置并发送测试卡片`)
    process.exit(command === '--help' || command === 'help' || command === undefined ? 0 : 1)
  }
}

if (isDirectRun()) runCli()

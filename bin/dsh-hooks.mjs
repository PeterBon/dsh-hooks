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
 * Requires Node >= 22. The shared setup logic lives in lib/feishu.js (also
 * used by the web GUI's /dsh-hooks/feishu routes); this CLI half only adds
 * the terminal QR rendering, the browser opener, and the argument parsing.
 */
import { spawn } from 'node:child_process'
import QRCode from 'qrcode'
import { runDryRun } from '../lib/dry-run.js'
import {
  FEISHU_CONFIG_PATH,
  mergePatchYaml,
  notifyScriptPath,
  patchPath,
  runFeishuSetup,
  runFeishuTest,
  setupHooks,
  stableScriptPath,
  writeConfig,
} from '../lib/feishu.js'

/** Backward-compatible alias (feishu-notify parity). */
export const CONFIG_PATH = FEISHU_CONFIG_PATH

export {
  mergePatchYaml,
  notifyScriptPath,
  patchPath,
  setupHooks,
  stableScriptPath,
  writeConfig,
}

/** Open a URL in the default browser (best-effort, never throws). */
export function openInBrowser(url) {
  return new Promise((resolve) => {
    const command =
      process.platform === 'darwin'
        ? { executable: 'open', args: [url] }
        : process.platform === 'win32'
          ? { executable: 'cmd', args: ['/c', 'start', '', url] }
          : { executable: 'xdg-open', args: [url] }
    const child = spawn(command.executable, command.args, { detached: true, stdio: 'ignore' })
    child.on('error', () => resolve(undefined))
    child.on('spawn', () => {
      child.unref()
      resolve(undefined)
    })
  })
}

/**
 * CLI front for the shared setup flow: print the terminal QR and open the
 * authorization URL in the default browser when the code is ready.
 */
export async function setupFeishu({
  profile = 'web',
  registerAppFn,
  print = console.log,
  printErr = console.error,
  openUrl = openInBrowser,
  paths = {},
} = {}) {
  return runFeishuSetup({
    profile,
    print,
    printErr,
    paths,
    ...(registerAppFn !== undefined ? { registerAppFn } : {}),
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
      // Never let a browser-opener failure break the scan flow.
      void Promise.resolve(openUrl(authorization.url)).catch(() => undefined)
    },
  })
}

/** CLI front for the shared test-card flow. */
export async function testFeishu({ print = console.log, paths = {} } = {}) {
  return runFeishuTest({ print, paths })
}

const [, , command, ...args] = process.argv

function cliArgs(args) {
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile') opts.profile = args[++i]
  }
  return opts
}

/** Parse the dry-run flags; the first positional arg is the event. */
function cliDryRunArgs(args) {
  const opts = { event: '', execute: false }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reason') opts.reason = args[++i]
    else if (args[i] === '--tool') opts.tool = args[++i]
    else if (args[i] === '--session-name') opts.sessionName = args[++i]
    else if (args[i] === '--profile') opts.profile = args[++i]
    else if (args[i] === '--execute') opts.execute = true
    else if (!args[i].startsWith('-') && opts.event === '') opts.event = args[i]
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
  } else if (command === 'dry-run') {
    const opts = cliDryRunArgs(args)
    if (!opts.event) {
      console.error('缺少事件参数，用法：dsh-hooks dry-run <event> [--reason <kind>] [--profile <name>] [--execute]')
      process.exit(1)
    }
    runDryRun(opts)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  } else {
    console.error(`用法:
  dsh-hooks feishu-setup [--profile <name>]   扫码创建飞书通知机器人并自动配置
  dsh-hooks feishu-test                       验证配置并发送测试卡片
  dsh-hooks dry-run <event> [--reason <kind>] [--tool <name>] [--profile <name>] [--execute]
                                              模拟事件，列出会触发/被过滤的 hook（--execute 实际执行）`)
    process.exit(command === '--help' || command === 'help' || command === undefined ? 0 : 1)
  }
}

if (isDirectRun()) runCli()

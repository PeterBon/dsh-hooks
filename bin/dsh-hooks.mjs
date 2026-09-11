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
import { loadHistoryPath, runDryRun } from '../lib/dry-run.js'
import { formatTailRecord, HistoryTailer, matchesTailFilter } from '../lib/tail.js'
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
  const opts = { event: '', execute: false, fields: {} }
  /** Numeric context fields the CLI exposes by name (plus the generic --field). */
  const fieldFlags = {
    '--running-subagents': 'runningSubagents',
    '--duration-ms': 'durationMs',
    '--tool-duration-ms': 'toolDurationMs',
    '--usage-input': 'usageInputTokens',
    '--usage-output': 'usageOutputTokens',
  }
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (flag === '--reason') opts.reason = args[++i]
    else if (flag === '--tool') opts.tool = args[++i]
    else if (flag === '--session-name') opts.sessionName = args[++i]
    else if (flag === '--profile') opts.profile = args[++i]
    else if (flag === '--execute') opts.execute = true
    else if (fieldFlags[flag] !== undefined) opts.fields[fieldFlags[flag]] = cliNumber(args[++i])
    else if (flag === '--field') {
      // Generic escape hatch: --field usageCacheReadTokens=90000
      const [name, raw] = String(args[++i] ?? '').split('=')
      if (name) opts.fields[name] = cliNumber(raw)
    } else if (!flag.startsWith('-') && opts.event === '') opts.event = flag
  }
  return opts
}

/**
 * CLI numbers stay numbers when they parse (the mock only accepts finite
 * numbers); anything else is passed through so the dry-run report can name
 * the field as ignored instead of silently dropping it.
 */
function cliNumber(raw) {
  const value = Number(raw)
  return raw !== undefined && raw !== '' && Number.isFinite(value) ? value : raw
}

/** Parse the tail flags. */
function cliTailArgs(args) {
  const opts = { json: false }
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (flag === '--profile') opts.profile = args[++i]
    else if (flag === '--n') opts.n = cliNumber(args[++i])
    else if (flag === '--event') opts.event = args[++i]
    else if (flag === '--outcome') opts.outcome = args[++i]
    else if (flag === '--hook') opts.hook = args[++i]
    else if (flag === '--interval') opts.intervalMs = cliNumber(args[++i])
    else if (flag === '--file') opts.file = args[++i]
    else if (flag === '--json') opts.json = true
  }
  return opts
}

/**
 * Follow the history JSONL: print the last `n` records, then everything
 * appended afterwards. Returns a stop function (the CLI wires it to SIGINT,
 * tests call it directly).
 */
export async function tailHistory(options = {}) {
  const print = options.print ?? console.log
  const intervalMs = typeof options.intervalMs === 'number' && options.intervalMs > 0 ? options.intervalMs : 500
  const file = options.file ?? loadHistoryPath(options.profile ?? 'web')
  const filter = { event: options.event, outcome: options.outcome, hook: options.hook }
  const active = Object.entries(filter).filter(([, value]) => value !== undefined)
  const tailer = new HistoryTailer(file)

  const emit = (records) => {
    for (const record of records) {
      if (!matchesTailFilter(record, filter)) continue
      print(options.json ? JSON.stringify(record) : formatTailRecord(record))
    }
  }

  print(`dsh-hooks tail · ${file}`)
  if (active.length > 0) print(`过滤：${active.map(([key, value]) => `${key}=${value}`).join(' ')}`)
  const backfill = tailer.backfill(typeof options.n === 'number' ? options.n : 10)
  if (backfill.length === 0) print('（暂无历史记录）')
  emit(backfill)
  print('—— 实时跟进中（Ctrl+C 退出）——')

  const timer = setInterval(() => {
    try {
      const batch = tailer.readNew()
      if (batch.reset) print(`⚠ 文件被截断或轮转，已从头跟进：${file}`)
      emit(batch.records)
    } catch (error) {
      print(`⚠ 读取失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }, intervalMs)

  return () => clearInterval(timer)
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
      console.error('缺少事件参数，用法：dsh-hooks dry-run <event> [--reason <kind>] [--profile <name>] [--execute] [--running-subagents N]')
      process.exit(1)
    }
    runDryRun(opts)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  } else if (command === 'tail') {
    const opts = cliTailArgs(args)
    tailHistory(opts)
      .then((stop) => {
        process.on('SIGINT', () => {
          stop()
          process.exit(0)
        })
      })
      .catch((error) => {
        console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  } else {
    console.error(`用法:
  dsh-hooks feishu-setup [--profile <name>]   扫码创建飞书通知机器人并自动配置
  dsh-hooks feishu-test                       验证配置并发送测试卡片
  dsh-hooks dry-run <event> [--reason <kind>] [--tool <name>] [--profile <name>] [--execute]
                                               [--running-subagents N] [--duration-ms N] [--tool-duration-ms N]
                                               [--usage-input N] [--usage-output N] [--field <名>=<值>]
                                              模拟事件，列出会触发/被过滤的 hook（--execute 实际执行）
  dsh-hooks tail [--profile <name>] [--n <count>] [--event <name>] [--outcome <name>] [--hook <text>]
                                               [--json] [--interval <ms>] [--file <path>]
                                               实时跟踪执行历史（history.jsonl），Ctrl+C 退出`)
    process.exit(command === '--help' || command === 'help' || command === undefined ? 0 : 1)
  }
}

if (isDirectRun()) runCli()

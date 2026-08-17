#!/usr/bin/env node
/**
 * Generic webhook notification for dsh-hooks — posts the hook context as
 * one JSON document to any HTTP endpoint. Works with Slack incoming
 * webhooks, Discord, Lark/DingTalk custom bots, ntfy, Bark, n8n, or any
 * automation service that accepts a JSON POST.
 *
 * Reads the hook context from DSH_HOOK_* environment variables and POSTs
 * `application/json`. Only present context fields are included, so the
 * payload shape is stable and small.
 *
 * Required environment (set in the dsh process environment, NOT in config):
 *   DSH_HOOKS_WEBHOOK_URL     target webhook URL
 * …or pass it as the first flag: --url <url>
 *
 * Usage (from a dsh-hooks config):
 *   - on: 'turn/end'
 *     when: 'completed'
 *     run: 'node examples/notify-webhook.mjs --url https://hooks.slack.com/services/T/B/…'
 *   - on: 'tool/call'
 *     run: 'node examples/notify-webhook.mjs'
 *
 * Optional flags:
 *   --url <url>        webhook URL (overrides the environment variable)
 *   --slack            post Slack-style `{ text }` instead of the full
 *                      context document
 *   --timeout <ms>     fetch timeout (default 10000)
 *   -q                 quiet: suppress success output (hooks parse stdout)
 *
 * Zero npm dependencies: fetch is global in Node 18+.
 * The module exports its helpers for testing; it only executes when invoked
 * directly (node notify-webhook.mjs), not when imported.
 */
import { pathToFileURL } from 'node:url'

/** Every DSH_HOOK_* variable this script understands, in payload order. */
const CONTEXT_VARS = [
  'DSH_HOOK_EVENT',
  'DSH_HOOK_TIMESTAMP',
  'DSH_HOOK_SESSION_ID',
  'DSH_HOOK_SESSION_NAME',
  'DSH_HOOK_CWD',
  'DSH_HOOK_TURN',
  'DSH_HOOK_STEP',
  'DSH_HOOK_REASON',
  'DSH_HOOK_TOOL',
  'DSH_HOOK_CALL_ID',
  'DSH_HOOK_TOOL_ARGS',
  'DSH_HOOK_TOOL_ERROR',
  'DSH_HOOK_SOURCE',
  'DSH_HOOK_DURATION_MS',
  'DSH_HOOK_STATUS',
  'DSH_HOOK_ERROR',
  'DSH_HOOK_CONTENT',
  'DSH_HOOK_USAGE_INPUT_TOKENS',
  'DSH_HOOK_USAGE_OUTPUT_TOKENS',
  'DSH_HOOK_USAGE_CACHE_READ_TOKENS',
  'DSH_HOOK_USAGE_CACHE_WRITE_TOKENS',
  'DSH_HOOK_USAGE_REASONING_TOKENS',
]

/** Parse one context env var into a number, or undefined when absent/garbage. */
function num(value) {
  if (value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Read the raw context: only the variables that are present and non-empty. */
export function readEnv(env = process.env) {
  const raw = {}
  for (const name of CONTEXT_VARS) {
    const value = env[name]
    if (value !== undefined && value !== '') raw[name] = value
  }
  return raw
}

/** Group one raw env snapshot into a nested JSON payload. */
export function buildPayload(raw) {
  const payload = {}
  const session = {}
  if (raw.DSH_HOOK_SESSION_ID) session.id = raw.DSH_HOOK_SESSION_ID
  if (raw.DSH_HOOK_SESSION_NAME) session.name = raw.DSH_HOOK_SESSION_NAME
  if (raw.DSH_HOOK_CWD) session.cwd = raw.DSH_HOOK_CWD
  if (Object.keys(session).length > 0) payload.session = session
  if (raw.DSH_HOOK_EVENT) payload.event = raw.DSH_HOOK_EVENT
  if (raw.DSH_HOOK_TIMESTAMP) payload.timestamp = raw.DSH_HOOK_TIMESTAMP
  const turn = num(raw.DSH_HOOK_TURN)
  const step = num(raw.DSH_HOOK_STEP)
  const durationMs = num(raw.DSH_HOOK_DURATION_MS)
  if (turn !== undefined) payload.turn = turn
  if (step !== undefined) payload.step = step
  if (durationMs !== undefined) payload.duration_ms = durationMs
  if (raw.DSH_HOOK_REASON) payload.reason = raw.DSH_HOOK_REASON
  if (raw.DSH_HOOK_TOOL) payload.tool = raw.DSH_HOOK_TOOL
  if (raw.DSH_HOOK_CALL_ID) payload.call_id = raw.DSH_HOOK_CALL_ID
  if (raw.DSH_HOOK_TOOL_ARGS) payload.tool_args = raw.DSH_HOOK_TOOL_ARGS
  if (raw.DSH_HOOK_TOOL_ERROR) payload.tool_error = raw.DSH_HOOK_TOOL_ERROR
  if (raw.DSH_HOOK_SOURCE) payload.source = raw.DSH_HOOK_SOURCE
  if (raw.DSH_HOOK_STATUS) payload.status = raw.DSH_HOOK_STATUS
  if (raw.DSH_HOOK_ERROR) payload.error = raw.DSH_HOOK_ERROR
  if (raw.DSH_HOOK_CONTENT) payload.content = raw.DSH_HOOK_CONTENT
  const usage = {}
  const usageInput = num(raw.DSH_HOOK_USAGE_INPUT_TOKENS)
  const usageOutput = num(raw.DSH_HOOK_USAGE_OUTPUT_TOKENS)
  const usageCacheRead = num(raw.DSH_HOOK_USAGE_CACHE_READ_TOKENS)
  const usageCacheWrite = num(raw.DSH_HOOK_USAGE_CACHE_WRITE_TOKENS)
  const usageReasoning = num(raw.DSH_HOOK_USAGE_REASONING_TOKENS)
  if (usageInput !== undefined) usage.input_tokens = usageInput
  if (usageOutput !== undefined) usage.output_tokens = usageOutput
  if (usageCacheRead !== undefined) usage.cache_read_tokens = usageCacheRead
  if (usageCacheWrite !== undefined) usage.cache_write_tokens = usageCacheWrite
  if (usageReasoning !== undefined) usage.reasoning_tokens = usageReasoning
  if (Object.keys(usage).length > 0) payload.usage = usage
  return payload
}

/** One-line summary for Slack-style `{ text }` payloads. */
export function summarize(payload) {
  const label = payload.session?.name || payload.session?.id || ''
  const where = label ? ` · ${label}` : ''
  switch (payload.event) {
    case 'turn/end':
      if (payload.reason === 'completed') return `✅ 任务已完成${where}（回合 #${payload.turn ?? '?'}）`
      if (payload.error) return `❌ 任务失败${where}: ${payload.error.slice(0, 200)}`
      return `⏸ 任务${payload.reason ? ` ${payload.reason}` : '结束'}${where}（回合 #${payload.turn ?? '?'}）`
    case 'tool/call':
      return `🔧 调用工具 ${payload.tool ?? ''}${where}`
    case 'tool/result':
      if (payload.tool_error) return `⚠️ 工具 ${payload.tool ?? ''} 失败${where}: ${payload.tool_error}`
      return `✅ 工具 ${payload.tool ?? ''} 完成${where}`
    case 'approval/asked':
      return `⏳ 需要审批：工具 ${payload.tool ?? ''}${where}`
    case 'user/message':
      return `💬 新消息${where}${payload.content ? `：${payload.content.slice(0, 120)}` : ''}`
    case 'session/title':
      return `🏷 会话改名${where}: ${payload.session?.name ?? ''}`
    case 'session/created':
      return `✨ 会话开始${where}`
    case 'session/disposed':
      return `🏁 会话结束${where}`
    default:
      return `🔔 DSH ${payload.event ?? '事件'}${where}`
  }
}

/** Parse the optional CLI flags. */
export function parseArgs(args) {
  const opts = { url: '', slack: false, timeoutMs: 10000, quiet: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--url') opts.url = args[++i] ?? ''
    else if (a === '--slack') opts.slack = true
    else if (a === '--timeout') {
      const n = Number(args[++i])
      if (Number.isFinite(n) && n > 0) opts.timeoutMs = n
    } else if (a === '-q') opts.quiet = true
  }
  return opts
}

/** POST one JSON body to the webhook with a timeout; one retry on transport failure. */
export async function postJson(url, body, timeoutMs = 10000) {
  const attempt = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }
  let response
  try {
    response = await attempt()
  } catch (error) {
    // One retry for transient transport failures (webhook endpoints often
    // drop the first request when cold).
    try {
      response = await attempt()
    } catch (retryError) {
      const cause = retryError instanceof Error ? retryError.message : String(retryError)
      throw new Error(`webhook 请求失败（重试后仍失败）: ${cause}`)
    }
  }
  if (!response.ok) throw new Error(`webhook 响应 HTTP ${response.status}`)
}

/** Full pipeline for one hook event. Exported for tests and CLI use. */
export async function run(env = process.env, args = []) {
  const opts = parseArgs(args)
  const url = opts.url || env.DSH_HOOKS_WEBHOOK_URL
  if (!url) throw new Error('缺少 webhook URL：请设置 DSH_HOOKS_WEBHOOK_URL 或传 --url <url>')
  const raw = readEnv(env)
  if (!raw.DSH_HOOK_EVENT) throw new Error('缺少 DSH_HOOK_EVENT（请通过 dsh-hooks 触发，不要直接运行）')
  const payload = buildPayload(raw)
  const body = opts.slack ? { text: summarize(payload) } : payload
  await postJson(url, body, opts.timeoutMs)
  return body
}

function isDirectRun() {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  run(process.env, process.argv.slice(2))
    .then((body) => {
      if (!parseArgs(process.argv.slice(2)).quiet) {
        const text = JSON.stringify(body)
        console.log(`已发送 webhook: ${text.length > 80 ? text.slice(0, 80) + '…' : text}`)
      }
      process.exit(0)
    })
    .catch((error) => {
      console.warn(`[dsh-hooks/notify-webhook] ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    })
}

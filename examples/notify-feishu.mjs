#!/usr/bin/env node
/**
 * Feishu card notification for dsh-hooks — style, content and truncation
 * lengths follow the feishu-notify conventions (information-list card with
 * a colored header, time/dir/session meta lines, hr-separated body).
 *
 * Reads the hook context from DSH_HOOK_* environment variables and posts an
 * interactive card through the Feishu app API (im/v1/messages). Works without
 * a group custom bot — any user/chat the app bot can reach is a valid target.
 *
 * Required environment (set in the dsh process environment, NOT in config):
 *   DSH_HOOKS_FEISHU_APP_ID      Feishu open platform app id (cli_...)
 *   DSH_HOOKS_FEISHU_APP_SECRET  Feishu open platform app secret
 *   DSH_HOOKS_FEISHU_TO          Target open_id / chat_id to notify
 *
 * Usage (from a dsh-hooks config):
 *   - on: 'turn/end'
 *     when: 'completed'
 *     run: 'node examples/notify-feishu.mjs'
 *   - on: 'approval/asked'
 *     run: 'node examples/notify-feishu.mjs --approval'
 *
 * Optional flags:
 *   --text                 send plain text instead of a card
 *   --header <color>       card header color (default depends on event)
 *   --title <title>        card title (default depends on event)
 *   --note <note>          extra meta line at the bottom
 *   -q                     quiet: suppress success output (hooks parse stdout)
 *
 * Card body: `turn/end` shows the turn's final assistant text directly
 * (failure detail first when the turn errored); other events carry their
 * own one-line summaries.
 *
 * Zero npm dependencies: fetch is global in Node 18+.
 * The module exports its helpers for testing; it only executes when invoked
 * directly (node notify-feishu.mjs), not when imported.
 */
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Default config file written by `dsh-hooks feishu-setup` (feishu-notify parity). */
export const DEFAULT_CONFIG_PATH = join(homedir(), '.dsh', 'dsh-hooks', 'feishu-config.json')

/** Common Feishu API error codes with Chinese hints (feishu-notify parity). */
const ERROR_HINTS = {
  99991663: '应用缺少发送消息权限，请在开放平台「权限管理」开通 im:message:send_as_bot（以应用身份发消息）并发布新版本',
  99991667: '目标用户不在应用的可用范围内，请在管理后台「应用 → 可用范围」中添加该用户',
  99991668: '应用未发布或被停用，请在开放平台发布应用新版本',
  99991669: '应用凭证无效，请检查 app_id / app_secret',
  10003: 'app_secret 不正确',
  230002: '机器人不在该群聊中，请先把机器人拉入群聊',
}

/** Card header colors (feishu-notify parity). */
const CARD_HEADERS = new Set([
  'blue', 'wathet', 'turquoise', 'green', 'yellow', 'orange',
  'red', 'carmine', 'violet', 'purple', 'indigo', 'grey',
])

let tokenCache = new Map() // appId -> { value, expireAt }; tenant tokens are per-app

export function readEnv(env = process.env) {
  return {
    appId: env.DSH_HOOKS_FEISHU_APP_ID,
    appSecret: env.DSH_HOOKS_FEISHU_APP_SECRET,
    to: env.DSH_HOOKS_FEISHU_TO,
    event: env.DSH_HOOK_EVENT ?? '',
    sessionId: env.DSH_HOOK_SESSION_ID ?? '',
    sessionName: env.DSH_HOOK_SESSION_NAME ?? '',
    cwd: env.DSH_HOOK_CWD ?? '',
    turn: env.DSH_HOOK_TURN ?? '',
    reason: env.DSH_HOOK_REASON ?? '',
    tool: env.DSH_HOOK_TOOL ?? '',
    callId: env.DSH_HOOK_CALL_ID ?? '',
    durationMs: env.DSH_HOOK_DURATION_MS ?? '',
    status: env.DSH_HOOK_STATUS ?? '',
    error: env.DSH_HOOK_ERROR ?? '',
    content: env.DSH_HOOK_CONTENT ?? '',
    timestamp: env.DSH_HOOK_TIMESTAMP ?? '',
  }
}

/**
 * Load credentials from the local feishu-config.json (written by
 * `dsh-hooks feishu-setup`) and fill any missing credential fields —
 * environment variables always win. Also picks up `result_max_chars`,
 * the content truncation length (default 300); invalid values fall back.
 * Returns a merged context.
 */
export function mergeConfig(ctx, configPath = DEFAULT_CONFIG_PATH) {
  if (!existsSync(configPath)) return ctx
  let file
  try {
    file = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return ctx
  }
  if (typeof file !== 'object' || file === null) return ctx
  const fromFile =
    Number.isFinite(file.result_max_chars) && file.result_max_chars > 0
      ? Math.floor(file.result_max_chars)
      : undefined
  return {
    ...ctx,
    appId: ctx.appId || file.app_id || '',
    appSecret: ctx.appSecret || file.app_secret || '',
    to: ctx.to || file.target_id || '',
    // target_type=chat_id targets need a different receive_id_type; the
    // default pipeline posts to open_id, so a chat_id target must be sent
    // with receive_id_type=chat_id. readTargetType surfaces that choice.
    receiveIdType: ctx.to ? 'open_id' : file.target_type === 'chat_id' ? 'chat_id' : 'open_id',
    resultMaxChars: ctx.resultMaxChars ?? fromFile,
  }
}

/**
 * Clean and truncate text for the card body: normalize newlines, strip
 * trailing whitespace, collapse blank lines, and cut at a line boundary
 * near the limit with an ellipsis (feishu-notify truncateText parity).
 */
export function truncateText(text, max) {
  const t = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!t) return null
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastNl = cut.lastIndexOf('\n')
  return (lastNl > max / 2 ? cut.slice(0, lastNl) : cut) + '…'
}

/** `2026/8/13 00:28:12` style timestamps (feishu-notify parity). */
export function fmtTime(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return String(ms)
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`
}

/** Per-event card presentation (feishu-notify style: colored header + title). */
export function eventPresentation(ctx) {
  const { event, reason } = ctx
  switch (event) {
    case 'turn/end':
      if (reason === 'completed') return { header: 'green', title: '✅ 任务已完成' }
      if (reason === 'aborted' || reason === 'interrupted' || reason === 'blocked') {
        return { header: 'orange', title: '⏸ 任务中断' }
      }
      return { header: 'red', title: '❌ 任务失败' }
    case 'approval/asked':
      return { header: 'orange', title: '⏳ 需要审批' }
    case 'agent/error':
      return { header: 'red', title: '⚠️ Agent 出错' }
    case 'agent/status':
      return { header: 'blue', title: '🤖 Agent 状态' }
    case 'turn/start':
      return { header: 'blue', title: '▶️ 任务开始' }
    case 'agent/created':
      return { header: 'green', title: '✨ 会话已创建' }
    case 'agent/disposed':
      return { header: 'grey', title: '🏁 会话已结束' }
    default:
      return { header: 'blue', title: '🔔 DSH 通知' }
  }
}

/** Body text for the event, respecting feishu-notify truncation lengths. */
export function buildBody(ctx) {
  const { event, reason, tool, error, status, sessionId, content, turn } = ctx
  const resultMaxChars = ctx.resultMaxChars ?? 300
  const lines = []
  if (event === 'turn/end') {
    // The turn's own words are the story: show the final assistant text
    // directly, with the failure detail first when the turn errored.
    if (error) lines.push(`详情：${truncateText(error, 200) ?? error}`)
    if (content) lines.push(truncateText(content, resultMaxChars) ?? content)
  } else if (event === 'approval/asked') {
    lines.push('有一个操作等你批准')
    if (tool) lines.push(`工具：${tool}`)
    if (reason) lines.push(`原因：${truncateText(reason, 200) ?? reason}`)
  } else if (event === 'agent/error') {
    lines.push('Agent 循环报告了错误')
    if (error) lines.push(`详情：${truncateText(error, 200) ?? error}`)
  } else if (event === 'agent/status') {
    lines.push(`状态：${status || '未知'}`)
  } else if (event === 'turn/start') {
    lines.push(`开始回合：#${turn ?? ''}`)
  } else {
    if (sessionId) lines.push(`会话：${sessionId}`)
  }
  const body = lines.join('\n')
  // Overall body cap: the truncated 内容/详情 lines stay intact
  // (feishu-notify caps the result text itself, not the whole card).
  return truncateText(body, 1200) ?? body
}

/**
 * Information-list card: meta lines in one div (compact), an hr, then the
 * body. Matches the feishu-notify buildCard layout.
 */
export function buildCard(ctx, { header, title, note, body, now = new Date() } = {}) {
  const metaLines = [`🕐 ${fmtTime(now)}`]
  if (ctx.cwd) metaLines.push(`📁 ${truncateText(ctx.cwd, 200) ?? ctx.cwd}`)
  if (ctx.sessionName || ctx.sessionId) {
    metaLines.push(`🗒 会话 ${truncateText(ctx.sessionName || ctx.sessionId, 80) ?? (ctx.sessionName || ctx.sessionId)}`)
  }
  if (note) metaLines.push(`📝 ${note}`)
  const elements = [{ tag: 'div', text: { tag: 'lark_md', content: metaLines.join('\n') } }]
  if (body) {
    elements.push({ tag: 'hr' })
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: body } })
  }
  return {
    config: { wide_screen_mode: true },
    header: { template: header, title: { tag: 'plain_text', content: title } },
    elements,
  }
}

/**
 * Read one Feishu API response body. A non-2xx status fails first (surfacing
 * the API's own message when it answered JSON); a 2xx body that is not JSON
 * fails with a parse error instead of a confusing TypeError.
 */
async function readApiBody(response) {
  if (!response.ok) {
    let apiMsg = ''
    try {
      const body = await response.json()
      if (body && typeof body.msg === 'string' && body.msg) apiMsg = ` msg=${body.msg}`
    } catch {
      // Non-JSON error page (proxy/HTML) — the status alone is the message.
    }
    throw new Error(`飞书接口 HTTP ${response.status}${apiMsg}`)
  }
  try {
    return await response.json()
  } catch {
    throw new Error('飞书接口返回了无法解析的响应')
  }
}

/** POST to the Feishu API with network-failure translation. */
async function postApi(url, init) {
  let response
  try {
    response = await fetch(url, init)
  } catch (error) {
    throw new Error(`飞书接口请求失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  return readApiBody(response)
}

export async function getToken(appId, appSecret, now = Date.now()) {
  const cached = tokenCache.get(appId)
  if (cached && now < cached.expireAt) return cached.value
  const body = await postApi('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  if (body.code !== 0) {
    const hint = ERROR_HINTS[body.code]
    throw new Error(`飞书接口错误 code=${body.code} msg=${body.msg}${hint ? `\n  → ${hint}` : ''}`)
  }
  const entry = {
    value: body.tenant_access_token,
    expireAt: now + (body.expire - 300) * 1000, // 提前 5 分钟过期
  }
  tokenCache.set(appId, entry)
  return entry.value
}

export async function sendCard(token, to, card, receiveIdType = 'open_id') {
  const body = await postApi(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: to,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }),
  })
  if (body.code !== 0) {
    const hint = ERROR_HINTS[body.code]
    throw new Error(`飞书接口错误 code=${body.code} msg=${body.msg}${hint ? `\n  → ${hint}` : ''}`)
  }
}

export async function sendText(token, to, text, receiveIdType = 'open_id') {
  const body = await postApi(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: to,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  })
  if (body.code !== 0) {
    const hint = ERROR_HINTS[body.code]
    throw new Error(`飞书接口错误 code=${body.code} msg=${body.msg}${hint ? `\n  → ${hint}` : ''}`)
  }
}

/** Parse the optional CLI flags; positional args join into a body override. */
export function parseArgs(args) {
  const opts = { textMode: false, header: '', title: '', note: '', quiet: false, bodyParts: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--text') opts.textMode = true
    else if (a === '--header') opts.header = args[++i]
    else if (a === '--title') opts.title = args[++i]
    else if (a === '--note') opts.note = args[++i]
    else if (a === '--approval') { /* approval events already build their own body */ }
    else if (a === '-q') opts.quiet = true
    else opts.bodyParts.push(a)
  }
  opts.body = opts.bodyParts.join(' ').trim()
  return opts
}

/** Full pipeline for one hook event. Exported for tests and CLI use. */
export async function run(ctx, args = [], configPath = DEFAULT_CONFIG_PATH) {
  const merged = mergeConfig(ctx, configPath)
  if (!merged.appId || !merged.appSecret) throw new Error('缺少 DSH_HOOKS_FEISHU_APP_ID / DSH_HOOKS_FEISHU_APP_SECRET')
  if (!merged.to) throw new Error('缺少 DSH_HOOKS_FEISHU_TO（接收者 open_id 或 chat_id）')
  if (!merged.event) throw new Error('缺少 DSH_HOOK_EVENT（请通过 dsh-hooks 触发，不要直接运行）')
  const opts = parseArgs(args)
  const presentation = eventPresentation(merged)
  const header = opts.header || presentation.header
  const title = opts.title || presentation.title
  if (!CARD_HEADERS.has(header)) {
    throw new Error(`无效的卡片配色: ${header}，可选: ${[...CARD_HEADERS].join(', ')}`)
  }
  const token = await getToken(merged.appId, merged.appSecret)
  const receiveIdType = merged.receiveIdType ?? 'open_id'
  if (opts.textMode) {
    const text = opts.body || buildBody(merged)
    await sendText(token, merged.to, text, receiveIdType)
    return { kind: 'text', text }
  }
  const card = buildCard(merged, {
    header,
    title,
    note: opts.note || undefined,
    body: opts.body || buildBody(merged),
  })
  await sendCard(token, merged.to, card, receiveIdType)
  return { kind: 'card', card }
}

function isDirectRun() {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  run(readEnv(), process.argv.slice(2))
    .then((result) => {
      if (!parseArgs(process.argv.slice(2)).quiet) {
        if (result.kind === 'card') console.log(`已发送卡片: ${result.card.header.title.content}`)
        else console.log(`已发送文本: ${result.text.length > 50 ? result.text.slice(0, 50) + '…' : result.text}`)
      }
      process.exit(0)
    })
    .catch((error) => {
      console.warn(`[dsh-hooks/notify-feishu] ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    })
}

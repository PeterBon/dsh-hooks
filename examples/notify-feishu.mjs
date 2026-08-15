#!/usr/bin/env node
/**
 * Feishu notification example for dsh-hooks.
 *
 * Reads the hook context from DSH_HOOK_* environment variables and posts a
 * text message through the Feishu app API (im/v1/messages). Works without a
 * group custom bot — any user/chat the app bot can reach is a valid target.
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
 * Zero npm dependencies: fetch is global in Node 18+.
 *
 * The module exports its helpers for testing; it only executes when invoked
 * directly (node notify-feishu.mjs), not when imported.
 */
import { pathToFileURL } from 'node:url'

export function readEnv(env = process.env) {
  return {
    appId: env.DSH_HOOKS_FEISHU_APP_ID,
    appSecret: env.DSH_HOOKS_FEISHU_APP_SECRET,
    to: env.DSH_HOOKS_FEISHU_TO,
    event: env.DSH_HOOK_EVENT ?? '',
    sessionId: env.DSH_HOOK_SESSION_ID ?? '',
    reason: env.DSH_HOOK_REASON ?? '',
    tool: env.DSH_HOOK_TOOL ?? '',
    durationMs: env.DSH_HOOK_DURATION_MS ?? '',
    status: env.DSH_HOOK_STATUS ?? '',
    error: env.DSH_HOOK_ERROR ?? '',
  }
}

export function buildText(ctx) {
  const { event, sessionId, reason, tool, durationMs, status, error } = ctx
  if (event === 'turn/end') {
    const lines = ['【任务结束】']
    if (reason) lines.push(`结果：${reason}`)
    if (durationMs) lines.push(`耗时：${formatDuration(Number(durationMs))}`)
    if (sessionId) lines.push(`会话：${sessionId}`)
    return lines.join('\n')
  }
  if (event === 'approval/asked') {
    const lines = ['【等待审批】']
    if (tool) lines.push(`工具：${tool}`)
    if (reason) lines.push(`原因：${reason}`)
    if (sessionId) lines.push(`会话：${sessionId}`)
    return lines.join('\n')
  }
  if (event === 'agent/error') {
    const lines = ['【Agent 错误】']
    if (error) lines.push(error.slice(0, 200))
    if (sessionId) lines.push(`会话：${sessionId}`)
    return lines.join('\n')
  }
  if (event === 'agent/status') {
    const lines = ['【Agent 状态】']
    if (status) lines.push(`状态：${status}`)
    if (sessionId) lines.push(`会话：${sessionId}`)
    return lines.join('\n')
  }
  const lines = [`【DSH 事件】${event}`]
  if (sessionId) lines.push(`会话：${sessionId}`)
  return lines.join('\n')
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return String(ms)
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`
}

export async function getToken(appId, appSecret) {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const body = await response.json()
  if (body.code !== 0) throw new Error(`token failed: ${body.code} ${body.msg}`)
  return body.tenant_access_token
}

export async function sendMessage(token, to, text) {
  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
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
  const body = await response.json()
  if (body.code !== 0) throw new Error(`send failed: ${body.code} ${body.msg}`)
}

/** Full pipeline for one hook event. Exported for tests and CLI use. */
export async function run(ctx) {
  if (!ctx.appId || !ctx.appSecret) throw new Error('缺少 DSH_HOOKS_FEISHU_APP_ID / DSH_HOOKS_FEISHU_APP_SECRET')
  if (!ctx.to) throw new Error('缺少 DSH_HOOKS_FEISHU_TO（接收者 open_id 或 chat_id）')
  if (!ctx.event) throw new Error('缺少 DSH_HOOK_EVENT（请通过 dsh-hooks 触发，不要直接运行）')
  const token = await getToken(ctx.appId, ctx.appSecret)
  await sendMessage(token, ctx.to, buildText(ctx))
}

function isDirectRun() {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  run(readEnv())
    .then(() => process.exit(0))
    .catch((error) => {
      console.warn(`[dsh-hooks/notify-feishu] ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    })
}

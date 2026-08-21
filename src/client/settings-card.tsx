/**
 * The dsh-hooks settings card: status badges (incl. live runner stats), a
 * manual event tester, notify-channel quick tests, the Feishu connect flow
 * (QR scan + truncation editor with preview + test card + disconnect), the
 * hook list / editor (saves back to cordis.patch.yml with a backup), and a
 * collapsed-by-default execution-history timeline at the bottom — all
 * served by the core plugin's /dsh-hooks/* routes. Degrades gracefully:
 * fetch failures show an inline notice with a retry button, never a crash.
 * Registered into the shell's `settings.section` slot.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  fetchFeishuStatus,
  fetchHistory,
  fetchStatus,
  formatTime,
  outcomeLabel,
  outcomeTone,
  postFeishuCancel,
  postFeishuConfig,
  postFeishuDisconnect,
  postFeishuSetup,
  postFeishuTest,
  postHooksSave,
  postNotifyTest,
  postTest,
  type FeishuStatusInfo,
  type HistoryRecord,
  type HookDescriptor,
  type HookWireSpec,
  type StatusInfo,
  type TestResult,
} from './api.ts'

// Card styles are injected once at apply time (settings-card.module.css?inline
// in index.ts); every class name below is a stable dh-* literal.

const EVENTS = [
  'turn/start',
  'turn/end',
  'step/end',
  'tool/call',
  'tool/result',
  'user/message',
  'approval/asked',
  'session/title',
  'session/created',
  'session/disposed',
  'agent/created',
  'agent/disposed',
  'agent/error',
  'agent/status',
]

const TURN_END_REASONS = ['completed', 'error', 'aborted', 'blocked', 'max-tokens', 'interrupted']

const DEFAULT_TRUNCATE = 300

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function storeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode): the setting lives for this page only.
  }
}

/** Serialize one hook as a cordis.patch.yml snippet for copy-paste. */
function hookToYaml(hook: HookWireSpec): string {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  const lines: string[] = [`- on: ${q(hook.on)}`]
  if (hook.when !== undefined && hook.when !== '') lines.push(`  when: ${q(hook.when)}`)
  if (hook.match !== undefined && Object.keys(hook.match).length > 0) {
    lines.push('  match:')
    for (const [field, pattern] of Object.entries(hook.match)) lines.push(`    ${field}: ${q(pattern)}`)
  }
  if (hook.notify !== undefined && hook.notify !== null) {
    lines.push('  notify:')
    lines.push(`    channel: ${q(hook.notify.channel)}`)
    if (hook.notify.url !== undefined && hook.notify.url !== '') lines.push(`    url: ${q(hook.notify.url)}`)
    if (hook.notify.slack === true) lines.push('    slack: true')
  } else if (hook.run !== undefined && hook.run !== '') {
    lines.push(`  run: ${q(hook.run)}`)
  }
  if (hook.timeoutMs !== undefined && hook.timeoutMs !== 10000) lines.push(`  timeoutMs: ${hook.timeoutMs}`)
  if (hook.retries !== undefined && hook.retries !== 0) lines.push(`  retries: ${hook.retries}`)
  if (hook.retryDelayMs !== undefined && hook.retryDelayMs !== 500) lines.push(`  retryDelayMs: ${hook.retryDelayMs}`)
  return lines.join('\n')
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

function parseNum(value: string): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toWire(draft: HookWireSpec): HookWireSpec {
  return {
    on: draft.on,
    when: draft.when === '' ? undefined : draft.when,
    match: draft.match !== undefined && Object.keys(draft.match).length > 0 ? draft.match : undefined,
    run: draft.notify === undefined || draft.notify === null ? draft.run?.trim() || undefined : undefined,
    notify: draft.notify ?? null,
    timeoutMs: draft.timeoutMs,
    retries: draft.retries,
    retryDelayMs: draft.retryDelayMs,
  }
}

const NEW_HOOK: HookWireSpec = { on: 'turn/end', when: 'completed', run: '' }

/** Settings-slot component; the shell's slot machinery supplies the props. */
export function HooksSettingsCard(_props: object): ReactNode {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [history, setHistory] = useState<HistoryRecord[] | null>(null)
  const [historyOpen, setHistoryOpenState] = useState(() => {
    try {
      return localStorage.getItem('dsh-hooks.historyOpen') === '1'
    } catch {
      return false
    }
  })
  const [loadError, setLoadError] = useState(false)
  const [event, setEvent] = useState('turn/end')
  const [reason, setReason] = useState('completed')
  const [tool, setTool] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Notify-channel quick test.
  const [notifyChannel, setNotifyChannel] = useState<'webhook' | 'desktop'>('webhook')
  const [notifyUrl, setNotifyUrl] = useState('')
  const [notifySlack, setNotifySlack] = useState(false)
  const [notifyResult, setNotifyResult] = useState<{ ok: boolean; text: string; preview?: string } | null>(null)

  // Feishu connect flow.
  const [feishu, setFeishu] = useState<FeishuStatusInfo | null>(null)
  const [profile, setProfile] = useState(() => loadStored('dsh-hooks.profile', 'web'))
  const [setupTruncate, setSetupTruncate] = useState(String(DEFAULT_TRUNCATE))
  const [truncateDraft, setTruncateDraft] = useState<string | null>(null)
  const [configMessage, setConfigMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [feishuError, setFeishuError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Hook editor.
  const [editing, setEditing] = useState(false)
  const [draftHooks, setDraftHooks] = useState<HookWireSpec[]>([])
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const setHistoryOpen = (open: boolean) => {
    setHistoryOpenState(open)
    storeValue('dsh-hooks.historyOpen', open ? '1' : '0')
  }

  const refresh = useCallback(async () => {
    const [statusInfo, records, feishuInfo] = await Promise.all([
      fetchStatus(),
      fetchHistory(30),
      fetchFeishuStatus(),
    ])
    setStatus(statusInfo)
    setHistory(records)
    setFeishu(feishuInfo)
    setLoadError(statusInfo === null && records === null)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 5000)
    return () => clearInterval(timer)
  }, [refresh])

  // Poll faster while a QR scan session is pending, and tick the countdown.
  const pending = feishu?.setup?.status === 'pending'
  useEffect(() => {
    if (!pending) return
    const poll = setInterval(() => void refresh(), 2000)
    const tick = setInterval(() => {
      setCountdown(remainingSeconds(feishu?.setup?.expiresAtMs))
    }, 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [pending, feishu?.setup?.expiresAtMs, refresh])

  // Clear the manual-test report whenever its inputs change.
  useEffect(() => {
    setTestResult(null)
  }, [event, reason, tool])

  const runTest = async (execute: boolean) => {
    const result = await postTest({
      event,
      reason: event === 'turn/end' && reason !== '' ? reason : undefined,
      tool: tool !== '' ? tool : undefined,
      execute,
    })
    setTestResult(result)
    if (execute) void refresh()
  }

  const sendNotifyTest = async () => {
    setNotifyResult(null)
    const result = await postNotifyTest(notifyChannel, notifyUrl.trim() || undefined, notifySlack)
    if (!result.ok) setNotifyResult({ ok: false, text: result.error ?? '发送失败' })
    else setNotifyResult({ ok: true, text: result.message ?? '已发送', preview: result.preview })
  }

  const connectFeishu = async () => {
    setFeishuError(null)
    setTestMessage(null)
    setConfigMessage(null)
    setCountdown(null)
    const parsed = Number(setupTruncate)
    const result = await postFeishuSetup(
      profile.trim() !== '' ? profile.trim() : 'web',
      Number.isFinite(parsed) ? parsed : undefined,
    )
    if (!result.ok) {
      setFeishuError(result.error ?? '启动扫码失败')
      return
    }
    if (result.setup !== undefined) {
      setFeishu({
        configured: false,
        appId: null,
        targetKind: null,
        target: null,
        setup: result.setup,
        resultMaxChars: Number.isFinite(parsed) ? parsed : DEFAULT_TRUNCATE,
        preview: '',
      })
      setCountdown(remainingSeconds(result.setup.expiresAtMs))
    }
  }

  const cancelFeishu = async () => {
    await postFeishuCancel()
    void refresh()
  }

  const sendTestCard = async () => {
    setTestMessage(null)
    setFeishuError(null)
    const result = await postFeishuTest()
    if (!result.ok) setFeishuError(result.error ?? '发送失败')
    else setTestMessage(result.message ?? '已发送')
  }

  const saveTruncate = async () => {
    const value = Number(truncateDraft)
    if (!Number.isFinite(value)) {
      setConfigMessage({ ok: false, text: '请输入数字' })
      return
    }
    const result = await postFeishuConfig(value)
    if (!result.ok) {
      setConfigMessage({ ok: false, text: result.error ?? '保存失败' })
      return
    }
    setTruncateDraft(null)
    setConfigMessage({ ok: true, text: `已保存：卡片内容最长 ${result.resultMaxChars} 字符` })
    void refresh()
  }

  const disconnectFeishu = async () => {
    if (!window.confirm('确定断开飞书连接？将删除本机凭据文件。')) return
    const removeHooks = window.confirm('同时从 cordis.patch.yml 移除飞书通知 hooks？\n（推荐移除，否则这些 hook 每次触发都会失败）')
    setFeishuError(null)
    const result = await postFeishuDisconnect(profile.trim() !== '' ? profile.trim() : 'web', removeHooks)
    if (!result.ok) setFeishuError(result.error ?? '断开失败')
    else setConfigMessage({ ok: true, text: result.message ?? '已断开' })
    void refresh()
  }

  // ---- hook editor --------------------------------------------------------

  const startEdit = () => {
    if (editing) {
      setEditing(false)
      setDraftHooks([])
      setSaveMessage(null)
      return
    }
    const current = status?.hooks ?? []
    setDraftHooks(
      current.map((hook: HookDescriptor): HookWireSpec => ({
        on: hook.on,
        when: hook.when,
        match: hook.match !== undefined ? { ...hook.match } : undefined,
        run: hook.run,
        notify:
          hook.notify === undefined
            ? null
            : { channel: hook.notify.channel, url: hook.notify.url, slack: hook.notify.slack },
        timeoutMs: hook.timeoutMs,
        retries: hook.retries,
        retryDelayMs: hook.retryDelayMs,
      })),
    )
    setSaveMessage(null)
    setEditing(true)
  }

  const patchDraft = (index: number, patch: Partial<HookWireSpec>) => {
    setDraftHooks((list) => list.map((hook, i) => (i === index ? { ...hook, ...patch } : hook)))
  }

  const patchAction = (index: number, channel: string) => {
    setDraftHooks((list) =>
      list.map((hook, i) => {
        if (i !== index) return hook
        if (channel === '') return { ...hook, notify: null, run: hook.run ?? '' }
        return {
          ...hook,
          notify: { channel: channel as 'webhook' | 'desktop', url: hook.notify?.url, slack: hook.notify?.slack },
          run: undefined,
        }
      }),
    )
  }

  const patchMatchKey = (index: number, oldKey: string, newKey: string) => {
    setDraftHooks((list) =>
      list.map((hook, i) => {
        if (i !== index || hook.match === undefined) return hook
        const match = { ...hook.match }
        if (oldKey !== newKey) {
          delete match[oldKey]
          if (newKey !== '') match[newKey] = hook.match![oldKey]
        }
        return { ...hook, match }
      }),
    )
  }

  const patchMatchValue = (index: number, field: string, value: string) => {
    setDraftHooks((list) =>
      list.map((hook, i) =>
        i === index ? { ...hook, match: { ...(hook.match ?? {}), [field]: value } } : hook,
      ),
    )
  }

  const removeMatch = (index: number, field: string) => {
    setDraftHooks((list) =>
      list.map((hook, i) => {
        if (i !== index || hook.match === undefined) return hook
        const match = { ...hook.match }
        delete match[field]
        return { ...hook, match }
      }),
    )
  }

  const addMatch = (index: number) => {
    setDraftHooks((list) =>
      list.map((hook, i) =>
        i === index ? { ...hook, match: { ...(hook.match ?? {}), '': '' } } : hook,
      ),
    )
  }

  const removeDraft = (index: number) => {
    setDraftHooks((list) => list.filter((_, i) => i !== index))
  }

  const saveHooks = async () => {
    const wire = draftHooks.map(toWire)
    for (const [i, hook] of wire.entries()) {
      if ((hook.run === undefined || hook.run === '') && (hook.notify === undefined || hook.notify === null)) {
        setSaveMessage({ ok: false, text: `hook #${i + 1}：请填写 run 命令或选择通知渠道` })
        return
      }
    }
    const result = await postHooksSave(profile.trim() !== '' ? profile.trim() : 'web', wire)
    if (!result.ok) {
      setSaveMessage({ ok: false, text: result.error ?? '保存失败' })
      return
    }
    setSaveMessage({ ok: true, text: result.message ?? '已保存' })
    setEditing(false)
    setDraftHooks([])
    void refresh()
  }

  const copyHookYaml = async (hook: HookWireSpec, index: number) => {
    const ok = await copyText(hookToYaml(hook))
    if (ok) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500)
    }
  }

  const truncateValue = truncateDraft ?? String(feishu?.resultMaxChars ?? DEFAULT_TRUNCATE)

  return (
    <div className="dh-card">
      <div className="dh-card-head">
        <span className="dh-card-title">dsh-hooks</span>
        <span className="dh-badges">
          {status !== null && (
            <>
              <span className="dh-badge">v{status.version}</span>
              <span className="dh-badge">{status.hookCount} hooks</span>
              <span className="dh-badge">{status.historyCount} 记录</span>
              {status.stats.inFlight > 0 && <span className="dh-badge">{status.stats.inFlight} 运行中</span>}
              {status.stats.recentFailures > 0 && (
                <span className="dh-badge dh-badge-bad">{status.stats.recentFailures} 失败</span>
              )}
            </>
          )}
        </span>
      </div>

      {loadError && (
        <div className="dh-error-banner">
          <span>无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。</span>
          <button
            type="button"
            className="dh-button dh-error-retry"
            onClick={() => {
              setLoadError(false)
              void refresh()
            }}
          >
            重试
          </button>
        </div>
      )}

      <section>
        <h3 className="dh-section-title">手动测试</h3>
        <div className="dh-test-form">
          <div className="dh-test-row">
            <label className="dh-field">
              <span className="dh-field-label">事件</span>
              <select className="dh-select" value={event} onChange={(e) => setEvent(e.target.value)}>
                {EVENTS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {event === 'turn/end' && (
              <label className="dh-field">
                <span className="dh-field-label">reason</span>
                <input
                  className="dh-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="completed"
                />
              </label>
            )}
            <label className="dh-field">
              <span className="dh-field-label">tool（可选）</span>
              <input
                className="dh-input"
                value={tool}
                onChange={(e) => setTool(e.target.value)}
                placeholder="pwsh"
              />
            </label>
          </div>
          <div className="dh-buttons">
            <button type="button" className="dh-button" onClick={() => void runTest(false)}>
              模拟（看匹配）
            </button>
            <button type="button" className="dh-button dh-button-primary" onClick={() => void runTest(true)}>
              执行（真实触发）
            </button>
          </div>
          {testResult !== null && (
            <div className="dh-test-results">
              <div className="dh-test-line" key="head">
                {testResult.event}：{testResult.matched}/{testResult.total} 个 hook 触发
                {testResult.executed ? '（已执行）' : ''}
              </div>
              {testResult.lines.map((line) => (
                <div
                  key={line.index}
                  className={`dh-test-line ${line.matched ? 'dh-test-line-match' : 'dh-test-line-skip'}`}
                >
                  {line.matched ? '✅' : '⏭'} [{line.index}] {line.summary}
                  {!line.matched && line.why !== '' ? ` —— ${line.why}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="dh-section-title">通知渠道测试</h3>
        <div className="dh-test-form">
          <div className="dh-test-row">
            <label className="dh-field">
              <span className="dh-field-label">渠道</span>
              <select
                className="dh-select"
                value={notifyChannel}
                onChange={(e) => setNotifyChannel(e.target.value as 'webhook' | 'desktop')}
              >
                <option value="webhook">webhook（HTTP JSON）</option>
                <option value="desktop">desktop（系统通知）</option>
              </select>
            </label>
            {notifyChannel === 'webhook' && (
              <label className="dh-field">
                <span className="dh-field-label">URL（留空用 DSH_HOOKS_WEBHOOK_URL）</span>
                <input
                  className="dh-input"
                  value={notifyUrl}
                  onChange={(e) => setNotifyUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/…"
                />
              </label>
            )}
          </div>
          {notifyChannel === 'webhook' && (
            <label className="dh-check">
              <input type="checkbox" checked={notifySlack} onChange={(e) => setNotifySlack(e.target.checked)} />
              Slack 风格单行摘要
            </label>
          )}
          <div className="dh-buttons">
            <button type="button" className="dh-button dh-button-primary" onClick={() => void sendNotifyTest()}>
              发送测试通知
            </button>
          </div>
          {notifyResult !== null && (
            <>
              <div className={notifyResult.ok ? 'dh-test-line dh-test-line-match' : 'dh-feishu-error'}>
                {notifyResult.text}
              </div>
              {notifyResult.ok && notifyResult.preview !== undefined && (
                <div className="dh-feishu-hint">发送内容：{notifyResult.preview}</div>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <h3 className="dh-section-title">飞书通知</h3>
        <div className="dh-feishu">
          {pending ? (
            <div className="dh-feishu-qr">
              {feishu?.setup?.qrDataUrl !== undefined && feishu?.setup?.qrDataUrl !== '' ? (
                <img className="dh-feishu-qr-img" src={feishu.setup.qrDataUrl} alt="飞书扫码授权二维码" />
              ) : (
                <a className="dh-feishu-link" href={feishu?.setup?.qrUrl} target="_blank" rel="noreferrer">
                  在浏览器中打开飞书授权链接
                </a>
              )}
              <div className="dh-feishu-line">
                请用飞书扫码{countdown !== null && countdown > 0 ? `（${countdown}s 内有效）` : ''}
              </div>
              <div className="dh-buttons">
                <button type="button" className="dh-button" onClick={() => void cancelFeishu()}>
                  取消
                </button>
              </div>
            </div>
          ) : feishu?.configured === true && !reconnecting ? (
            <div className="dh-feishu-status">
              <div className="dh-feishu-line dh-feishu-ok">
                ✅ 已连接 · 应用 {feishu.appId ?? '?'}
                {feishu.targetKind !== null && feishu.target !== null
                  ? `（接收者 ${feishu.targetKind}: ${feishu.target}）`
                  : ''}
              </div>
              <div className="dh-feishu-row">
                <label className="dh-field dh-field-narrow">
                  <span className="dh-field-label">卡片截断长度（50–5000 字符）</span>
                  <input
                    className="dh-input"
                    type="number"
                    min={50}
                    max={5000}
                    value={truncateValue}
                    onChange={(e) => setTruncateDraft(e.target.value)}
                  />
                </label>
                <button type="button" className="dh-button" onClick={() => void saveTruncate()}>
                  保存
                </button>
              </div>
              {feishu.preview !== undefined && feishu.preview !== '' && (
                <div className="dh-feishu-preview" title="按当前截断长度生成的卡片正文预览">
                  卡片预览：{feishu.preview}
                </div>
              )}
              {configMessage !== null && (
                <div className={configMessage.ok ? 'dh-feishu-line dh-feishu-ok' : 'dh-feishu-error'}>
                  {configMessage.text}
                </div>
              )}
              <div className="dh-buttons">
                <button type="button" className="dh-button dh-button-primary" onClick={() => void sendTestCard()}>
                  发送测试卡片
                </button>
                <button type="button" className="dh-button" onClick={() => setReconnecting(true)}>
                  重新连接
                </button>
                <button type="button" className="dh-button dh-button-danger" onClick={() => void disconnectFeishu()}>
                  断开连接
                </button>
              </div>
              {testMessage !== null && <div className="dh-feishu-line dh-feishu-ok">{testMessage}</div>}
              <div className="dh-feishu-hint">截断长度即时生效；重新扫码会覆盖现有应用凭据与本 profile 的飞书 hooks。</div>
            </div>
          ) : feishu?.setup?.status === 'failed' ? (
            <div className="dh-feishu-status">
              <div className="dh-feishu-error">连接失败：{feishu.setup.error ?? '未知错误'}</div>
              <div className="dh-buttons">
                <button type="button" className="dh-button dh-button-primary" onClick={() => void connectFeishu()}>
                  重试
                </button>
              </div>
            </div>
          ) : (
            <div className="dh-feishu-form">
              <div className="dh-test-row">
                <label className="dh-field">
                  <span className="dh-field-label">profile（写入哪个 profile 的 cordis.patch.yml）</span>
                  <input
                    className="dh-input"
                    value={profile}
                    onChange={(e) => {
                      setProfile(e.target.value)
                      storeValue('dsh-hooks.profile', e.target.value)
                    }}
                    placeholder="web"
                  />
                </label>
                <label className="dh-field dh-field-narrow">
                  <span className="dh-field-label">卡片截断长度（50–5000）</span>
                  <input
                    className="dh-input"
                    type="number"
                    min={50}
                    max={5000}
                    value={setupTruncate}
                    onChange={(e) => setSetupTruncate(e.target.value)}
                  />
                </label>
              </div>
              <div className="dh-buttons">
                <button type="button" className="dh-button dh-button-primary" onClick={() => void connectFeishu()}>
                  扫码连接飞书
                </button>
                {reconnecting && (
                  <button type="button" className="dh-button" onClick={() => setReconnecting(false)}>
                    返回
                  </button>
                )}
              </div>
              {feishuError !== null && <div className="dh-feishu-error">{feishuError}</div>}
              <div className="dh-feishu-hint">
                将创建名为「DSH 通知机器人」的飞书应用（仅 im:message:send_as_bot 权限），扫码者本人接收通知卡片；配置写入
                ~/.dsh/profiles/&lt;profile&gt;/cordis.patch.yml，重启 dsh web 后生效。
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="dh-section-head">
          <h3 className="dh-section-title">当前 hooks{status !== null ? ` · ${status.hookCount}` : ''}</h3>
          <button type="button" className="dh-button dh-toggle" onClick={startEdit}>
            {editing ? '取消编辑' : '编辑'}
          </button>
        </div>
        {editing ? (
          <div className="dh-hook-editor">
            <div className="dh-test-row">
              <label className="dh-field dh-field-narrow">
                <span className="dh-field-label">profile（写入哪个 cordis.patch.yml）</span>
                <input
                  className="dh-input"
                  value={profile}
                  onChange={(e) => {
                    setProfile(e.target.value)
                    storeValue('dsh-hooks.profile', e.target.value)
                  }}
                  placeholder="web"
                />
              </label>
            </div>
            {draftHooks.map((hook, index) => (
              <div className="dh-hook dh-hook-editing" key={index}>
                <div className="dh-test-row">
                  <label className="dh-field">
                    <span className="dh-field-label">事件</span>
                    <select
                      className="dh-select"
                      value={hook.on}
                      onChange={(e) =>
                        patchDraft(index, {
                          on: e.target.value,
                          when: e.target.value === 'turn/end' ? hook.when : undefined,
                        })
                      }
                    >
                      {EVENTS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {hook.on === 'turn/end' && (
                    <label className="dh-field">
                      <span className="dh-field-label">when（可选）</span>
                      <select
                        className="dh-select"
                        value={hook.when ?? ''}
                        onChange={(e) => patchDraft(index, { when: e.target.value === '' ? undefined : e.target.value })}
                      >
                        <option value="">全部原因</option>
                        {TURN_END_REASONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="dh-field">
                    <span className="dh-field-label">动作</span>
                    <select
                      className="dh-select"
                      value={hook.notify !== undefined && hook.notify !== null ? hook.notify.channel : ''}
                      onChange={(e) => patchAction(index, e.target.value)}
                    >
                      <option value="">执行命令（run）</option>
                      <option value="webhook">通知 webhook</option>
                      <option value="desktop">通知 desktop</option>
                    </select>
                  </label>
                </div>
                {hook.notify !== undefined && hook.notify !== null ? (
                  hook.notify.channel === 'webhook' ? (
                    <div className="dh-test-row">
                      <label className="dh-field">
                        <span className="dh-field-label">URL（留空用 DSH_HOOKS_WEBHOOK_URL）</span>
                        <input
                          className="dh-input"
                          value={hook.notify.url ?? ''}
                          onChange={(e) => patchDraft(index, { notify: { ...hook.notify!, url: e.target.value } })}
                          placeholder="https://hooks.slack.com/…"
                        />
                      </label>
                      <label className="dh-check">
                        <input
                          type="checkbox"
                          checked={hook.notify.slack === true}
                          onChange={(e) =>
                            patchDraft(index, { notify: { ...hook.notify!, slack: e.target.checked } })
                          }
                        />
                        Slack 单行摘要
                      </label>
                    </div>
                  ) : (
                    <div className="dh-feishu-hint">desktop：弹出系统桌面通知（内容为事件摘要）。</div>
                  )
                ) : (
                  <input
                    className="dh-input"
                    value={hook.run ?? ''}
                    onChange={(e) => patchDraft(index, { run: e.target.value })}
                    placeholder="node notify-feishu.mjs"
                  />
                )}
                {Object.entries(hook.match ?? {}).map(([field, pattern], mi) => (
                  <div className="dh-test-row" key={mi}>
                    <input
                      className="dh-input dh-match-key"
                      value={field}
                      onChange={(e) => patchMatchKey(index, field, e.target.value)}
                      placeholder="字段（tool）"
                    />
                    <input
                      className="dh-input"
                      value={pattern}
                      onChange={(e) => patchMatchValue(index, field, e.target.value)}
                      placeholder="正则（^(rm|git|ssh)）"
                    />
                    <button type="button" className="dh-button" onClick={() => removeMatch(index, field)}>
                      ×
                    </button>
                  </div>
                ))}
                <div className="dh-test-row">
                  <button type="button" className="dh-button dh-button-small" onClick={() => addMatch(index)}>
                    + 添加匹配字段
                  </button>
                  <label className="dh-field">
                    <span className="dh-field-label">timeoutMs</span>
                    <input
                      className="dh-input"
                      type="number"
                      value={hook.timeoutMs ?? ''}
                      onChange={(e) => patchDraft(index, { timeoutMs: parseNum(e.target.value) })}
                      placeholder="10000"
                    />
                  </label>
                  <label className="dh-field">
                    <span className="dh-field-label">retries</span>
                    <input
                      className="dh-input"
                      type="number"
                      value={hook.retries ?? ''}
                      onChange={(e) => patchDraft(index, { retries: parseNum(e.target.value) })}
                      placeholder="0"
                    />
                  </label>
                  <label className="dh-field">
                    <span className="dh-field-label">retryDelayMs</span>
                    <input
                      className="dh-input"
                      type="number"
                      value={hook.retryDelayMs ?? ''}
                      onChange={(e) => patchDraft(index, { retryDelayMs: parseNum(e.target.value) })}
                      placeholder="500"
                    />
                  </label>
                  <button type="button" className="dh-button dh-button-danger" onClick={() => removeDraft(index)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
            <div className="dh-buttons">
              <button type="button" className="dh-button" onClick={() => setDraftHooks((list) => [...list, { ...NEW_HOOK }])}>
                + 新增 hook
              </button>
            </div>
            <div className="dh-buttons">
              <button type="button" className="dh-button dh-button-primary" onClick={() => void saveHooks()}>
                保存到 cordis.patch.yml
              </button>
            </div>
            {saveMessage !== null && (
              <div className={saveMessage.ok ? 'dh-test-line dh-test-line-match' : 'dh-feishu-error'}>
                {saveMessage.text}
              </div>
            )}
            <div className="dh-feishu-hint">保存后写回配置文件并自动备份原文件；如未立即生效请重启 dsh web。</div>
          </div>
        ) : status === null || status.hooks.length === 0 ? (
          <div className="dh-empty">{status === null ? '加载中…' : '暂无 hook，点「编辑」添加'}</div>
        ) : (
          <div className="dh-hook-list">
            {status.hooks.map((hook) => (
              <div className="dh-hook" key={hook.index}>
                <div className="dh-hook-head">
                  <span className="dh-hook-event">
                    [{hook.index}] {hook.on}
                    {hook.when !== undefined && hook.when !== '' ? ` · ${hook.when}` : ''}
                  </span>
                  <span className="dh-hook-action" title={hook.run ?? `notify:${hook.notify?.channel}`}>
                    {hook.run !== undefined && hook.run !== ''
                      ? `run: ${hook.run}`
                      : `notify: ${hook.notify?.channel ?? '?'}${hook.notify?.url ? ` ${hook.notify.url}` : ''}${hook.notify?.slack ? ' (slack)' : ''}`}
                  </span>
                </div>
                {hook.match !== undefined && Object.keys(hook.match).length > 0 && (
                  <div className="dh-hook-match">
                    {Object.entries(hook.match)
                      .map(([field, pattern]) => `${field} =~ /${pattern}/`)
                      .join('，')}
                  </div>
                )}
                <div className="dh-hook-meta">
                  <button
                    type="button"
                    className="dh-button dh-button-small"
                    onClick={() => void copyHookYaml(hook, hook.index)}
                  >
                    {copiedIndex === hook.index ? '已复制 ✓' : '复制 YAML'}
                  </button>
                  <span className="dh-feishu-hint">
                    timeout {hook.timeoutMs ?? 10000}ms · retries {hook.retries ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="dh-section-head">
          <h3 className="dh-section-title">
            执行历史（最近 30 条）
            {status !== null && status.historyCount > 0 ? ` · ${status.historyCount} 条` : ''}
          </h3>
          <button
            type="button"
            className="dh-button dh-toggle"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        {historyOpen &&
          (history === null || history.length === 0 ? (
            <div className="dh-empty">{history === null ? '加载中…' : '暂无记录'}</div>
          ) : (
            <div className="dh-timeline">
              {[...history].reverse().map((record, index) => (
                <div className="dh-record" key={`${record.ts}-${index}`}>
                  <div className="dh-record-main">
                    <div className="dh-record-top">
                      <span className="dh-record-time">{formatTime(record.ts)}</span>
                      <span className="dh-record-event">{record.event}</span>
                      <span className={`dh-outcome ${outcomeClass(record.outcome)}`}>
                        {outcomeLabel(record.outcome)}
                      </span>
                    </div>
                    <div className="dh-record-command" title={record.command}>
                      {record.command}
                    </div>
                    {record.error !== undefined && record.error !== '' && (
                      <div className="dh-record-error">{record.error.slice(0, 200)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </section>
    </div>
  )
}

/** Seconds until the QR expires, or null when unknown/expired. */
function remainingSeconds(expiresAtMs: number | undefined): number | null {
  if (expiresAtMs === undefined) return null
  return Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000))
}

function outcomeClass(outcome: string): string {
  const tone = outcomeTone(outcome)
  switch (tone) {
    case 'ok':
      return 'dh-outcome-ok'
    case 'bad':
      return 'dh-outcome-bad'
    case 'warn':
      return 'dh-outcome-warn'
    default:
      return 'dh-outcome-neutral'
  }
}

/**
 * The dsh-hooks settings card: status badges, a manual event tester, the
 * Feishu connect flow (QR scan + truncation length + test card), and a
 * collapsed-by-default execution-history timeline at the bottom — all
 * served by the core plugin's /dsh-hooks/* routes. Degrades gracefully:
 * fetch failures show an inline notice, never a crash. Registered into the
 * shell's `settings.section` slot.
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
  postFeishuSetup,
  postFeishuTest,
  postTest,
  type FeishuStatusInfo,
  type HistoryRecord,
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

const DEFAULT_TRUNCATE = 300

/** Settings-slot component; the shell's slot machinery supplies the props. */
export function HooksSettingsCard(_props: object): ReactNode {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [history, setHistory] = useState<HistoryRecord[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [event, setEvent] = useState('turn/end')
  const [reason, setReason] = useState('completed')
  const [tool, setTool] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Feishu connect flow.
  const [feishu, setFeishu] = useState<FeishuStatusInfo | null>(null)
  const [profile, setProfile] = useState('web')
  const [setupTruncate, setSetupTruncate] = useState(String(DEFAULT_TRUNCATE))
  const [truncateDraft, setTruncateDraft] = useState<string | null>(null)
  const [configMessage, setConfigMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [feishuError, setFeishuError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

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
            </>
          )}
        </span>
      </div>

      {loadError && (
        <div className="dh-error-banner">
          无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。
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
                {feishu.targetKind !== null && feishu.target !== null ? `（接收者 ${feishu.targetKind}: ${feishu.target}）` : ''}
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
                    onChange={(e) => setProfile(e.target.value)}
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
          <h3 className="dh-section-title">
            执行历史（最近 30 条）
            {status !== null && status.historyCount > 0 ? ` · ${status.historyCount} 条` : ''}
          </h3>
          <button
            type="button"
            className="dh-button dh-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        {historyOpen && (
          history === null || history.length === 0 ? (
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
          )
        )}
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

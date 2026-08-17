/**
 * Hooks drawer dashboard: execution-history timeline, status badges, and a
 * manual event tester — all served by the core plugin's /dsh-hooks/* routes.
 * Degrades gracefully: every fetch failure shows an inline notice, never a
 * crash.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  fetchHistory,
  fetchStatus,
  formatTime,
  outcomeLabel,
  outcomeTone,
  postTest,
  type HistoryRecord,
  type StatusInfo,
  type TestResult,
} from './api.ts'

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

export interface HooksPanelProps {
  onClose: () => void
}

export function HooksPanel({ onClose }: HooksPanelProps) {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [history, setHistory] = useState<HistoryRecord[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [event, setEvent] = useState('turn/end')
  const [reason, setReason] = useState('completed')
  const [tool, setTool] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const refresh = useCallback(async () => {
    const [statusInfo, records] = await Promise.all([fetchStatus(), fetchHistory(50)])
    setStatus(statusInfo)
    setHistory(records)
    setLoadError(statusInfo === null && records === null)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 5000)
    return () => clearInterval(timer)
  }, [refresh])

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

  return (
    <aside className={'dh-panel'} aria-label="dsh-hooks 面板">
      <header className={'dh-header'}>
        <h1 className={'dh-title'}>dsh-hooks</h1>
        <span className={'dh-badges'}>
          {status !== null && (
            <>
              <span className={'dh-badge'}>v{status.version}</span>
              <span className={'dh-badge'}>{status.hookCount} hooks</span>
              <span className={'dh-badge'}>{status.historyCount} 记录</span>
            </>
          )}
        </span>
        <button type="button" className={'dh-close'} onClick={onClose} aria-label="关闭面板">
          ✕
        </button>
      </header>

      <div className={'dh-body'}>
        {loadError && (
          <div className={'dh-error-banner'}>
            无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。
          </div>
        )}

        <section>
          <h2 className={'dh-section-title'}>执行历史（最近 50 条）</h2>
          {history === null || history.length === 0 ? (
            <div className={'dh-empty'}>{history === null ? '加载中…' : '暂无记录'}</div>
          ) : (
            <div className={'dh-timeline'}>
              {[...history].reverse().map((record, index) => (
                <div className={'dh-record'} key={`${record.ts}-${index}`}>
                  <div className={'dh-record-main'}>
                    <div className={'dh-record-top'}>
                      <span className={'dh-record-time'}>{formatTime(record.ts)}</span>
                      <span className={'dh-record-event'}>{record.event}</span>
                      <span className={`${'dh-outcome'} ${outcomeClass(record.outcome)}`}>
                        {outcomeLabel(record.outcome)}
                      </span>
                    </div>
                    <div className={'dh-record-command'} title={record.command}>
                      {record.command}
                    </div>
                    {record.error !== undefined && record.error !== '' && (
                      <div className={'dh-record-error'}>{record.error.slice(0, 200)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className={'dh-section-title'}>手动测试</h2>
          <div className={'dh-test-form'}>
            <div className={'dh-test-row'}>
              <label className={'dh-field'}>
                <span className={'dh-field-label'}>事件</span>
                <select className={'dh-select'} value={event} onChange={(e) => setEvent(e.target.value)}>
                  {EVENTS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {event === 'turn/end' && (
                <label className={'dh-field'}>
                  <span className={'dh-field-label'}>reason</span>
                  <input
                    className={'dh-input'}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="completed"
                  />
                </label>
              )}
              <label className={'dh-field'}>
                <span className={'dh-field-label'}>tool（可选）</span>
                <input
                  className={'dh-input'}
                  value={tool}
                  onChange={(e) => setTool(e.target.value)}
                  placeholder="pwsh"
                />
              </label>
            </div>
            <div className={'dh-buttons'}>
              <button type="button" className={'dh-button'} onClick={() => void runTest(false)}>
                模拟（看匹配）
              </button>
              <button type="button" className={`dh-button dh-button-primary`} onClick={() => void runTest(true)}>
                执行（真实触发）
              </button>
            </div>
            {testResult !== null && (
              <div className={'dh-test-results'}>
                <div className={'dh-test-line'} key="head">
                  {testResult.event}：{testResult.matched}/{testResult.total} 个 hook 触发
                  {testResult.executed ? '（已执行）' : ''}
                </div>
                {testResult.lines.map((line) => (
                  <div
                    key={line.index}
                    className={`${'dh-test-line'} ${line.matched ? 'dh-test-line-match' : 'dh-test-line-skip'}`}
                  >
                    {line.matched ? '✅' : '⏭'} [{line.index}] {line.summary}
                    {!line.matched && line.why !== '' ? ` —— ${line.why}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
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

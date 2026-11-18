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
  filterHistory,
  formatDuration,
  formatHistoryTime,
  HISTORY_OUTCOMES,
  historyExportName,
  historyToJsonl,
  outcomeLabel,
  outcomeTone,
  postFeishuCancel,
  postFeishuConfig,
  postFeishuDisconnect,
  postFeishuSetup,
  postFeishuTest,
  postHooksSave,
  postNotifyTest,
  postTestDetailed,
  type FeishuStatusInfo,
  type HistoryFilter,
  type HistoryRecord,
  type HookDescriptor,
  type HookWireSpec,
  type NotifyTestChannel,
  type StatusInfo,
  type TestResult,
} from './api.ts'

// Card styles are injected once at apply time (settings-card.module.css?inline
// in index.ts); every class name below is a stable dh-* literal.

// Every event the config schema accepts, in HOOK_EVENTS order — the editor
// select must be able to show an existing hook's `on` value, and the tester
// must be able to simulate one (including the synthetic events, which have no
// session-log counterpart).
const EVENTS = [
  'turn/start',
  'turn/end',
  'tree/settled',
  'step/end',
  'tool/call',
  'tool/result',
  'user/message',
  'approval/asked',
  'approval/decided',
  'session/title',
  'session/created',
  'session/disposed',
  'agent/created',
  'agent/disposed',
  'agent/error',
  'agent/status',
  'hook/failed',
  'usage/daily',
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

/** Boolean panel state persisted across reloads (`'1'` / `'0'`). */
function useStoredBool(key: string, fallback = false): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => loadStored(key, fallback ? '1' : '0') === '1')
  const update = (next: boolean) => {
    setOpen(next)
    storeValue(key, next ? '1' : '0')
  }
  return [open, update]
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
  if (hook.enabled === false) lines.push('  enabled: false')
  if (hook.cwd !== undefined && hook.cwd !== '') lines.push(`  cwd: ${q(hook.cwd)}`)
  if (hook.maxConcurrent !== undefined) lines.push(`  maxConcurrent: ${hook.maxConcurrent}`)
  if (hook.debounceMs !== undefined) lines.push(`  debounceMs: ${hook.debounceMs}`)
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
  // Empty means "use the default": Number('') is 0, which for timeoutMs would
  // turn a cleared input into "time out immediately".
  const text = value.trim()
  if (text === '') return undefined
  const parsed = Number(text)
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
    enabled: draft.enabled === false ? false : undefined,
    cwd: draft.cwd === '' ? undefined : draft.cwd,
    maxConcurrent: draft.maxConcurrent,
    debounceMs: draft.debounceMs,
  }
}

const NEW_HOOK: HookWireSpec = { on: 'turn/end', when: 'completed', run: '' }

/**
 * The list the Feishu connect flow installs (`setupHooks` in `feishu.ts`):
 * five built-in `feishu` channel notifications. Mirrored here so the panel can
 * offer it as a one-click repair when the running profile has none — the state
 * that "connected" alone does not reveal.
 */
const DEFAULT_FEISHU_HOOKS: HookWireSpec[] = [
  { on: 'turn/end', when: 'completed', notify: { channel: 'feishu' } },
  { on: 'turn/end', when: 'error', notify: { channel: 'feishu' } },
  { on: 'turn/end', when: 'aborted', notify: { channel: 'feishu' } },
  { on: 'approval/asked', notify: { channel: 'feishu' } },
  { on: 'agent/error', notify: { channel: 'feishu' } },
]

/** Editable draft from the read-only status descriptor. */
function descriptorToDraft(hook: HookDescriptor): HookWireSpec {
  return {
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
    enabled: hook.enabled,
    cwd: hook.cwd,
    maxConcurrent: hook.maxConcurrent,
    debounceMs: hook.debounceMs,
  }
}

/** One-line summary of the non-default advanced values, for the collapsed row. */
function advancedSummary(hook: HookWireSpec): string {
  const parts: string[] = []
  if (hook.enabled === false) parts.push('已停用')
  if (hook.timeoutMs !== undefined && hook.timeoutMs !== 10000) parts.push(`timeout ${hook.timeoutMs}ms`)
  if (hook.retries !== undefined && hook.retries !== 0) parts.push(`重试 ${hook.retries}`)
  if (hook.retryDelayMs !== undefined && hook.retryDelayMs !== 500) parts.push(`间隔 ${hook.retryDelayMs}ms`)
  if (hook.cwd !== undefined && hook.cwd !== '') parts.push(`cwd ${hook.cwd}`)
  if (hook.maxConcurrent !== undefined) parts.push(`并发 ≤${hook.maxConcurrent}`)
  if (hook.debounceMs !== undefined && hook.debounceMs > 0) parts.push(`去抖 ${hook.debounceMs}ms`)
  return parts.length === 0 ? '（默认）' : `（${parts.join(' · ')}）`
}

/** Settings-slot component; the shell's slot machinery supplies the props. */
export function HooksSettingsCard(_props: object): ReactNode {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [history, setHistory] = useState<HistoryRecord[] | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [historyOpen, setHistoryOpen] = useStoredBool('dsh-hooks.historyOpen')
  const [loadError, setLoadError] = useState(false)
  // History filters persist across reloads, like the panel's open state.
  const [historyFilter, setHistoryFilterState] = useState<HistoryFilter>(() => {
    const hookIndex = Number(loadStored('dsh-hooks.historyHook', ''))
    return {
      event: loadStored('dsh-hooks.historyEvent', ''),
      outcome: loadStored('dsh-hooks.historyOutcome', ''),
      session: loadStored('dsh-hooks.historySession', ''),
      failed: loadStored('dsh-hooks.historyFailed', '0') === '1',
      hookIndex: Number.isInteger(hookIndex) && hookIndex > 0 ? hookIndex : undefined,
    }
  })
  const setHistoryFilter = (patch: Partial<HistoryFilter>) => {
    setHistoryFilterState((current) => {
      const next = { ...current, ...patch }
      storeValue('dsh-hooks.historyEvent', next.event ?? '')
      storeValue('dsh-hooks.historyOutcome', next.outcome ?? '')
      storeValue('dsh-hooks.historySession', next.session ?? '')
      storeValue('dsh-hooks.historyFailed', next.failed === true ? '1' : '0')
      storeValue('dsh-hooks.historyHook', next.hookIndex !== undefined ? String(next.hookIndex) : '')
      return next
    })
  }
  const visibleHistory = history === null ? null : filterHistory(history, historyFilter)
  const historyFiltered =
    (historyFilter.event ?? '') !== '' ||
    (historyFilter.outcome ?? '') !== '' ||
    (historyFilter.session ?? '') !== '' ||
    historyFilter.failed === true ||
    historyFilter.hookIndex !== undefined
  const [event, setEvent] = useState('turn/end')
  const [reason, setReason] = useState('completed')
  const [tool, setTool] = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testBusy, setTestBusy] = useState(false)
  const [testOpen, setTestOpen] = useStoredBool('dsh-hooks.testOpen')
  const [notifyTestOpen, setNotifyTestOpen] = useStoredBool('dsh-hooks.notifyTestOpen')
  // Optional numeric context overrides for the tester (empty = not simulated).
  const [mockFields, setMockFields] = useState({ runningSubagents: '', durationMs: '', usageInputTokens: '', usageOutputTokens: '' })

  // Notify-channel quick test. Feishu joins the list once it is connected and
  // becomes the default (that is the channel most people mean by "test the
  // notification") — until the user deliberately picks another one.
  const [notifyChannel, setNotifyChannel] = useState<NotifyTestChannel>('webhook')
  const [notifyChannelPinned, setNotifyChannelPinned] = useState(false)
  const [notifyUrl, setNotifyUrl] = useState('')
  const [notifySlack, setNotifySlack] = useState(false)
  const [notifyResult, setNotifyResult] = useState<{ ok: boolean; text: string; preview?: string } | null>(null)
  const [notifyBusy, setNotifyBusy] = useState(false)

  // Feishu connect flow. `feishu === null` means "never loaded" — an error must
  // not be rendered as "not connected", or the QR flow would overwrite live
  // credentials after a transient route failure.
  const [feishu, setFeishu] = useState<FeishuStatusInfo | null>(null)
  const [feishuRefreshError, setFeishuRefreshError] = useState(false)
  const [feishuBusy, setFeishuBusy] = useState(false)
  const [profile, setProfile] = useState(() => loadStored('dsh-hooks.profile', 'web'))
  const [setupTruncate, setSetupTruncate] = useState(String(DEFAULT_TRUNCATE))
  const [truncateDraft, setTruncateDraft] = useState<string | null>(null)
  const [configMessage, setConfigMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [feishuError, setFeishuError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnectRemoveHooks, setDisconnectRemoveHooks] = useState(true)

  // Hook editor.
  const [editing, setEditing] = useState(false)
  const [draftHooks, setDraftHooks] = useState<HookWireSpec[]>([])
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string; detail?: string } | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    // Skip background polls while the tab is hidden; the next visible tick
    // catches up.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const [statusInfo, feishuInfo, records] = await Promise.all([
      fetchStatus(),
      fetchFeishuStatus(),
      // History is only pulled while its timeline is open: a collapsed panel
      // should not move 200 records every 5 seconds.
      historyOpen ? fetchHistory(200) : Promise.resolve(null),
    ])
    // Keep the last good snapshot on a transient failure instead of blanking
    // the card.
    setStatus((current) => statusInfo ?? current)
    setFeishu((current) => feishuInfo ?? current)
    setFeishuRefreshError(feishuInfo === null)
    setLoadError(statusInfo === null && (!historyOpen || records === null))
    if (historyOpen) {
      setHistoryLoaded(true)
      setHistoryError(records === null)
      if (records !== null) setHistory(records)
    }
  }, [historyOpen])

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
    setTestError(null)
  }, [event, reason, tool, mockFields])

  // Follow the Feishu connection: default the channel test to it, and fall back
  // to webhook if the connection is dropped. A user-chosen channel is kept.
  useEffect(() => {
    if (notifyChannelPinned) return
    if (feishu?.configured === true) setNotifyChannel('feishu')
    else setNotifyChannel((current) => (current === 'feishu' ? 'webhook' : current))
  }, [feishu?.configured, notifyChannelPinned])

  /** Numeric overrides the user actually filled in (empty inputs are skipped). */
  const testFields = (): Record<string, number> | undefined => {
    const fields: Record<string, number> = {}
    for (const [key, raw] of Object.entries(mockFields)) {
      const text = raw.trim()
      if (text === '') continue
      const value = Number(text)
      if (Number.isFinite(value)) fields[key] = value
    }
    return Object.keys(fields).length > 0 ? fields : undefined
  }

  const runTest = async (execute: boolean) => {
    if (testBusy) return
    if (execute && !window.confirm('将真实触发匹配的 hook（执行命令或发送通知，有实际副作用），继续？')) return
    setTestBusy(true)
    setTestError(null)
    const result = await postTestDetailed({
      event,
      reason: event === 'turn/end' && reason !== '' ? reason : undefined,
      tool: tool !== '' ? tool : undefined,
      fields: testFields(),
      execute,
    })
    setTestBusy(false)
    if (!result.ok) {
      setTestResult(null)
      setTestError(result.error)
      return
    }
    setTestResult(result.result)
    if (execute) void refresh()
  }

  /** Download the filtered timeline as JSONL (same shape as the on-disk log). */
  const exportHistory = () => {
    const records = visibleHistory ?? []
    if (records.length === 0) return
    const name = historyExportName()
    const blob = new Blob([historyToJsonl(records)], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.click()
    } finally {
      // Release the object URL once the download has been handed off.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }

  const sendNotifyTest = async () => {
    if (notifyBusy) return
    setNotifyBusy(true)
    setNotifyResult(null)
    const result = await postNotifyTest(notifyChannel, notifyUrl.trim() || undefined, notifySlack)
    setNotifyBusy(false)
    if (!result.ok) setNotifyResult({ ok: false, text: result.error ?? '发送失败' })
    else setNotifyResult({ ok: true, text: result.message ?? '已发送', preview: result.preview })
  }

  /** Profile whose hooks are live — the editor target the user actually means. */
  const runningProfile = (status?.profile ?? '').trim()

  /** Selectable targets: running profile first, then every existing profile. */
  const profileOptions = (): string[] => {
    const names = new Set<string>()
    if (runningProfile !== '') names.add(runningProfile)
    for (const name of status?.profiles ?? []) names.add(name)
    if (profile.trim() !== '') names.add(profile.trim())
    return [...names].sort((a, b) => {
      if (a === runningProfile) return -1
      if (b === runningProfile) return 1
      return a.localeCompare(b)
    })
  }

  const chooseProfile = (name: string) => {
    setProfile(name)
    storeValue('dsh-hooks.profile', name)
  }

  // Point the editor at the profile that is actually live the first time the
  // panel sees it; an explicit choice already stored is never overridden.
  useEffect(() => {
    if (runningProfile === '') return
    if (loadStored('dsh-hooks.profile', '') !== '') return
    setProfile(runningProfile)
    storeValue('dsh-hooks.profile', runningProfile)
  }, [runningProfile])

  /** Live hooks that really deliver through Feishu. */
  const feishuHookCount = status?.hooks.filter((hook) => hook.notify?.channel === 'feishu').length ?? 0

  /**
   * Reminder under the profile inputs. Hooks (and the patch file they live in)
   * are per-profile while the Feishu credentials are shared under DSH_HOME, so
   * the panel must say which profile it is looking at — otherwise a connected
   * Feishu plus a `web` target silently leaves the running profile untouched.
   */
  const profileHint = (): ReactNode => {
    const target = profile.trim()
    if (runningProfile === '') {
      return <div className="dh-feishu-hint">hooks 与 cordis.patch.yml 都是 profile 级的。</div>
    }
    if (target !== '' && target !== runningProfile) {
      return (
        <div className="dh-feishu-warn">
          运行中的 profile 是 <strong>{runningProfile}</strong>，当前目标是 <strong>{target}</strong>：保存只会改 {target}{' '}
          的配置，运行中 profile 的会话不会推送。
        </div>
      )
    }
    return (
      <div className="dh-feishu-hint">
        运行中的 profile：{runningProfile}（hooks 是 profile 级的；飞书凭据在 DSH_HOME 里共享）
      </div>
    )
  }

  /**
   * Append the default Feishu hooks that are missing from the running profile.
   * Appending (instead of replacing the list) keeps the user's existing run /
   * webhook hooks intact — the old button overwrote them with the five
   * defaults.
   */
  const writeFeishuHooks = async () => {
    if (feishuBusy) return
    const target = runningProfile !== '' ? runningProfile : profile.trim() !== '' ? profile.trim() : 'web'
    const source = target === runningProfile ? (status?.hooks ?? []).map(descriptorToDraft) : []
    const missing = DEFAULT_FEISHU_HOOKS.filter(
      (candidate) =>
        !source.some(
          (hook) =>
            hook.on === candidate.on &&
            (hook.when ?? '') === (candidate.when ?? '') &&
            hook.notify?.channel === 'feishu',
        ),
    )
    if (missing.length === 0) {
      setConfigMessage({ ok: true, text: '当前 profile 已经具备这 5 条常用飞书 hook，无需写入。' })
      return
    }
    setFeishuBusy(true)
    setConfigMessage(null)
    const result = await postHooksSave(target, [...source, ...missing])
    setFeishuBusy(false)
    if (!result.ok) {
      setConfigMessage({ ok: false, text: result.error ?? '写入失败' })
      return
    }
    setConfigMessage({
      ok: true,
      text: `✅ 已补上 ${missing.length} 条飞书 hook（共 ${result.hookCount ?? source.length + missing.length} 条）到 ${target} profile（原文件已备份）。`,
    })
    void refresh()
  }

  const connectFeishu = async () => {
    if (feishuBusy) return
    setFeishuError(null)
    setTestMessage(null)
    setConfigMessage(null)
    setCountdown(null)
    const parsed = Number(setupTruncate)
    setFeishuBusy(true)
    const result = await postFeishuSetup(
      profile.trim() !== '' ? profile.trim() : 'web',
      Number.isFinite(parsed) ? parsed : undefined,
    )
    setFeishuBusy(false)
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
      setFeishuRefreshError(false)
      setCountdown(remainingSeconds(result.setup.expiresAtMs))
    }
  }

  const cancelFeishu = async () => {
    if (feishuBusy) return
    setFeishuBusy(true)
    await postFeishuCancel()
    setFeishuBusy(false)
    void refresh()
  }

  const sendTestCard = async () => {
    if (feishuBusy) return
    setTestMessage(null)
    setFeishuError(null)
    setFeishuBusy(true)
    const result = await postFeishuTest()
    setFeishuBusy(false)
    if (!result.ok) setFeishuError(result.error ?? '发送失败')
    else setTestMessage(result.message ?? '已发送')
  }

  const saveTruncate = async () => {
    if (feishuBusy) return
    const raw = truncateDraft ?? String(feishu?.resultMaxChars ?? DEFAULT_TRUNCATE)
    if (raw.trim() === '') {
      setConfigMessage({ ok: false, text: '请输入数字' })
      return
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) {
      setConfigMessage({ ok: false, text: '请输入数字' })
      return
    }
    setFeishuBusy(true)
    const result = await postFeishuConfig(value)
    setFeishuBusy(false)
    if (!result.ok) {
      setConfigMessage({ ok: false, text: result.error ?? '保存失败' })
      return
    }
    setTruncateDraft(null)
    setConfigMessage({ ok: true, text: `已保存：卡片内容最长 ${result.resultMaxChars} 字符` })
    void refresh()
  }

  const disconnectFeishu = async () => {
    if (feishuBusy) return
    setFeishuError(null)
    setFeishuBusy(true)
    const result = await postFeishuDisconnect(
      profile.trim() !== '' ? profile.trim() : 'web',
      disconnectRemoveHooks,
    )
    setFeishuBusy(false)
    if (!result.ok) setFeishuError(result.error ?? '断开失败')
    else {
      setConfigMessage({ ok: true, text: result.message ?? '已断开' })
      setDisconnectOpen(false)
    }
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
    setDraftHooks((status?.hooks ?? []).map(descriptorToDraft))
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
        // The feishu channel takes no url/slack: its credentials live in the
        // config file written by the connect flow below.
        if (channel === 'feishu') return { ...hook, notify: { channel: 'feishu' }, run: undefined }
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
      list.map((hook, i) => {
        if (i !== index) return hook
        const match = { ...(hook.match ?? {}) }
        // A unique placeholder key: two rows with the same empty key collapsed
        // into one object property, so the second click silently did nothing.
        let n = Object.keys(match).length + 1
        let key = `field${n}`
        while (key in match) key = `field${++n}`
        match[key] = ''
        return { ...hook, match }
      }),
    )
  }

  const removeDraft = (index: number) => {
    setDraftHooks((list) => list.filter((_, i) => i !== index))
  }

  const saveHooks = async () => {
    if (saveBusy) return
    const wire = draftHooks.map(toWire)
    for (const [i, hook] of wire.entries()) {
      if ((hook.run === undefined || hook.run === '') && (hook.notify === undefined || hook.notify === null)) {
        setSaveMessage({ ok: false, text: `hook #${i + 1}：请填写 run 命令或选择通知渠道` })
        return
      }
    }
    setSaveBusy(true)
    const result = await postHooksSave(profile.trim() !== '' ? profile.trim() : 'web', wire)
    setSaveBusy(false)
    if (!result.ok) {
      setSaveMessage({ ok: false, text: result.error ?? '保存失败' })
      return
    }
    const detail =
      result.patchFile !== undefined
        ? `写入 ${result.patchFile}${result.backupPath !== undefined ? `\n备份 ${result.backupPath}` : ''}`
        : undefined
    setSaveMessage({ ok: true, text: result.message ?? '已保存', detail })
    setEditing(false)
    setDraftHooks([])
    void refresh()
  }

  /** Open the timeline filtered to one hook (records now carry `hookIndex`). */
  const openHookHistory = (hookIndex: number) => {
    setHistoryFilter({ event: '', outcome: '', session: '', failed: false, hookIndex })
    setHistoryOpen(true)
    scrollToHistory()
  }

  /** Header failure badge → timeline filtered to failures and timeouts. */
  const showFailures = () => {
    setHistoryFilter({ event: '', outcome: '', session: '', failed: true, hookIndex: undefined })
    setHistoryOpen(true)
    scrollToHistory()
  }

  function scrollToHistory(): void {
    setTimeout(() => {
      document.getElementById('dsh-hooks-history')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 60)
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
      <header className="dh-card-head">
        <span className="dh-card-title">dsh-hooks</span>
        <span className="dh-badges">
          {status !== null && (
            <>
              <span className="dh-badge">v{status.version}</span>
              {status.profile !== undefined && status.profile !== '' && (
                <span className="dh-badge">{status.profile} profile</span>
              )}
              <span className="dh-badge">{status.hookCount} 个 hook</span>
              <span className="dh-badge">{status.historyCount} 条记录</span>
              {status.stats.inFlight > 0 && <span className="dh-badge">{status.stats.inFlight} 个运行中</span>}
              {status.stats.recentFailures > 0 && (
                <button
                  type="button"
                  className="dh-badge dh-badge-bad dh-badge-button"
                  title="只看失败和超时记录"
                  onClick={showFailures}
                >
                  {status.stats.recentFailures} 次失败
                </button>
              )}
            </>
          )}
        </span>
      </header>

      <div className="dh-profile">
        <label className="dh-field dh-field-narrow">
          <span className="dh-field-label">profile（写入目标）</span>
          <select
            className="dh-select"
            value={profile}
            title="只列出已有的 profile；运行中的 profile 会标注"
            onChange={(e) => chooseProfile(e.target.value)}
          >
            {profile === '' && (
              <option value="" disabled>
                请选择 profile
              </option>
            )}
            {profileOptions().map((name) => (
              <option key={name} value={name}>
                {name === runningProfile ? `${name}（运行中）` : name}
              </option>
            ))}
          </select>
        </label>
        {profileHint()}
      </div>

      {loadError && (
        <div className="dh-error-banner" role="alert">
          <span>无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且已在本 profile 生效。</span>
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

      <section className="dh-section">
        <div className="dh-section-head">
          <h3 className="dh-section-title">当前 hooks{status !== null ? ` · ${status.hookCount}` : ''}</h3>
          <button type="button" className="dh-button dh-toggle" onClick={startEdit}>
            {editing ? '取消编辑' : '编辑'}
          </button>
        </div>
        {!editing && saveMessage !== null && saveMessage.ok && (
          <div className="dh-test-line dh-test-line-match" role="status">
            {saveMessage.text}
            {saveMessage.detail !== undefined && <div className="dh-save-detail">{saveMessage.detail}</div>}
          </div>
        )}
        {editing ? (
          <div className="dh-hook-editor">
            {draftHooks.length === 0 && <div className="dh-empty">还没有 hook，点「新增 hook」开始。</div>}
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
                      <option value="feishu">通知 feishu</option>
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
                  ) : hook.notify.channel === 'feishu' ? (
                    <div className="dh-feishu-hint">
                      feishu：通过「飞书通知」里连接的凭据发送卡片（未连接时会发送失败）。
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
                      placeholder="正则或数值比较（^(rm|git|ssh) / >10000）"
                    />
                    <button
                      type="button"
                      className="dh-button"
                      aria-label={`删除匹配字段 ${field}`}
                      onClick={() => removeMatch(index, field)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="dh-test-row dh-hook-actions">
                  <button type="button" className="dh-button dh-button-small" onClick={() => addMatch(index)}>
                    + 添加匹配字段
                  </button>
                  <span className="dh-feishu-hint">高级：{advancedSummary(hook)}</span>
                  <button type="button" className="dh-button dh-button-small dh-button-danger" onClick={() => removeDraft(index)}>
                    删除
                  </button>
                </div>
                <details className="dh-advanced">
                  <summary>高级选项</summary>
                  <div className="dh-test-row">
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
                  </div>
                  <div className="dh-test-row">
                    <label className="dh-field">
                      <span className="dh-field-label">enabled</span>
                      <select
                        className="dh-select"
                        value={hook.enabled === false ? 'false' : 'true'}
                        onChange={(e) => patchDraft(index, { enabled: e.target.value === 'true' })}
                      >
                        <option value="true">启用</option>
                        <option value="false">停用</option>
                      </select>
                    </label>
                    <label className="dh-field">
                      <span className="dh-field-label">cwd</span>
                      <input
                        className="dh-input"
                        value={hook.cwd ?? ''}
                        onChange={(e) => patchDraft(index, { cwd: e.target.value })}
                        placeholder="session 或绝对路径"
                      />
                    </label>
                    <label className="dh-field">
                      <span className="dh-field-label">maxConcurrent</span>
                      <input
                        className="dh-input"
                        type="number"
                        value={hook.maxConcurrent ?? ''}
                        onChange={(e) => patchDraft(index, { maxConcurrent: parseNum(e.target.value) })}
                        placeholder="不限"
                      />
                    </label>
                    <label className="dh-field">
                      <span className="dh-field-label">debounceMs</span>
                      <input
                        className="dh-input"
                        type="number"
                        value={hook.debounceMs ?? ''}
                        onChange={(e) => patchDraft(index, { debounceMs: parseNum(e.target.value) })}
                        placeholder="0"
                      />
                    </label>
                  </div>
                </details>
              </div>
            ))}
            <div className="dh-buttons">
              <button type="button" className="dh-button" onClick={() => setDraftHooks((list) => [...list, { ...NEW_HOOK }])}>
                + 新增 hook
              </button>
            </div>
            <div className="dh-buttons">
              <button
                type="button"
                className="dh-button dh-button-primary"
                disabled={saveBusy}
                onClick={() => void saveHooks()}
              >
                {saveBusy ? '保存中…' : '保存到 cordis.patch.yml'}
              </button>
            </div>
            {saveMessage !== null && (
              <div
                className={saveMessage.ok ? 'dh-test-line dh-test-line-match' : 'dh-feishu-error'}
                role="status"
              >
                {saveMessage.text}
                {saveMessage.detail !== undefined && <div className="dh-save-detail">{saveMessage.detail}</div>}
              </div>
            )}
            <div className="dh-feishu-hint">保存后写回配置文件并自动备份原文件；支持热加载的 profile 无需重启。</div>
          </div>
        ) : status === null ? (
          <div className="dh-empty">加载中…</div>
        ) : status.hooks.length === 0 ? (
          <div className="dh-empty">暂无 hook，点「编辑」添加。</div>
        ) : (
          <div className="dh-hook-list">
            {status.hooks.map((hook) => (
              <div className={`dh-hook${hook.enabled === false ? ' dh-hook-disabled' : ''}`} key={hook.index}>
                <div className="dh-hook-head">
                  <span className="dh-hook-event">
                    [{hook.index}] {hook.on}
                    {hook.when !== undefined && hook.when !== '' ? ` · ${hook.when}` : ''}
                  </span>
                  {hook.enabled === false && <span className="dh-badge dh-badge-neutral">已停用</span>}
                  <span className="dh-hook-action" title={hook.run ?? `notify:${hook.notify?.channel}`}>
                    {hook.run !== undefined && hook.run !== ''
                      ? `run: ${hook.run}`
                      : `notify: ${hook.notify?.channel ?? '?'}${hook.notify?.url ? ` ${hook.notify.url}` : ''}${hook.notify?.slack ? ' (slack)' : ''}`}
                  </span>
                </div>
                {hook.match !== undefined && Object.keys(hook.match).length > 0 && (
                  <div className="dh-hook-match">
                    {Object.entries(hook.match)
                      .map(([field, pattern]) =>
                        /^([<>]=?|=)\s*-?\d/.test(pattern) ? `${field} ${pattern}` : `${field} =~ /${pattern}/`,
                      )
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
                  <button
                    type="button"
                    className="dh-button dh-button-small"
                    onClick={() => openHookHistory(hook.index)}
                  >
                    历史
                  </button>
                  <span className="dh-feishu-hint">
                    timeout {hook.timeoutMs ?? 10000}ms · retries {hook.retries ?? 0}
                    {hook.cwd !== undefined && hook.cwd !== '' ? ` · cwd: ${hook.cwd}` : ''}
                    {hook.maxConcurrent !== undefined ? ` · 并发≤${hook.maxConcurrent}` : ''}
                    {hook.debounceMs !== undefined && hook.debounceMs > 0 ? ` · 去抖 ${hook.debounceMs}ms` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dh-section">
        <h3 className="dh-section-title">飞书通知</h3>
        <div className="dh-feishu">
          {feishuRefreshError && (
            <div className="dh-error-banner" role="alert">
              飞书状态刷新失败{feishu !== null ? '，当前显示的是上次成功的数据' : ''}。
              <button type="button" className="dh-button dh-error-retry" onClick={() => void refresh()}>
                重试
              </button>
            </div>
          )}
          {feishu === null ? (
            feishuRefreshError ? null : <div className="dh-empty">正在读取飞书连接状态…</div>
          ) : pending ? (
            <div className="dh-feishu-qr">
              {feishu.setup?.qrDataUrl !== undefined && feishu.setup?.qrDataUrl !== '' ? (
                <img className="dh-feishu-qr-img" src={feishu.setup.qrDataUrl} alt="飞书扫码授权二维码" />
              ) : (
                <a className="dh-feishu-link" href={feishu.setup?.qrUrl} target="_blank" rel="noreferrer">
                  在浏览器中打开飞书授权链接
                </a>
              )}
              <div className="dh-feishu-line">
                请用飞书扫码{countdown !== null && countdown > 0 ? `（${countdown}s 内有效）` : ''}
              </div>
              <div className="dh-buttons">
                <button type="button" className="dh-button" disabled={feishuBusy} onClick={() => void cancelFeishu()}>
                  取消
                </button>
              </div>
            </div>
          ) : feishu.configured && !reconnecting ? (
            <div className="dh-feishu-status">
              <div className="dh-feishu-line dh-feishu-ok">
                ✅ 已连接 · 应用 {feishu.appId ?? '?'}
                {feishu.targetKind !== null && feishu.target !== null
                  ? `（接收者 ${feishu.targetKind}: ${feishu.target}）`
                  : ''}
              </div>
              {status !== null && feishuHookCount === 0 && (
                <div className="dh-feishu-warn">
                  <div>
                    飞书已连接，但当前 profile（{runningProfile !== '' ? runningProfile : '未知'}）里没有 hook 走飞书渠道，
                    会话结束不会推送。
                    {status.hookCount > 0
                      ? '可在「当前 hooks」里把通知渠道改成 feishu，或直接改 cordis.patch.yml。'
                      : ''}
                  </div>
                  <button
                    type="button"
                    className="dh-button dh-button-primary"
                    disabled={feishuBusy}
                    onClick={() => void writeFeishuHooks()}
                  >
                    补齐常用 5 条飞书 hook
                  </button>
                </div>
              )}
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
                <button type="button" className="dh-button" disabled={feishuBusy} onClick={() => void saveTruncate()}>
                  保存
                </button>
              </div>
              {feishu.preview !== undefined && feishu.preview !== '' && (
                <div className="dh-feishu-preview" title="按当前截断长度生成的卡片正文预览">
                  卡片预览：{feishu.preview}
                </div>
              )}
              {disconnectOpen ? (
                <div className="dh-feishu-warn">
                  <div>确定断开飞书连接？将删除本机凭据文件。</div>
                  <label className="dh-check">
                    <input
                      type="checkbox"
                      checked={disconnectRemoveHooks}
                      onChange={(e) => setDisconnectRemoveHooks(e.target.checked)}
                    />
                    同时从 cordis.patch.yml 移除飞书通知 hooks（推荐）
                  </label>
                  <div className="dh-buttons">
                    <button
                      type="button"
                      className="dh-button dh-button-danger"
                      disabled={feishuBusy}
                      onClick={() => void disconnectFeishu()}
                    >
                      {feishuBusy ? '断开中…' : '确认断开'}
                    </button>
                    <button type="button" className="dh-button" onClick={() => setDisconnectOpen(false)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dh-buttons">
                  <button
                    type="button"
                    className="dh-button dh-button-primary"
                    disabled={feishuBusy}
                    onClick={() => void sendTestCard()}
                  >
                    {feishuBusy ? '处理中…' : '发送测试卡片'}
                  </button>
                  <button type="button" className="dh-button" onClick={() => setReconnecting(true)}>
                    重新连接
                  </button>
                  <button type="button" className="dh-button dh-button-danger" onClick={() => setDisconnectOpen(true)}>
                    断开连接
                  </button>
                </div>
              )}
              {testMessage !== null && (
                <div className="dh-feishu-line dh-feishu-ok" role="status">
                  {testMessage}
                </div>
              )}
              {feishuError !== null && (
                <div className="dh-feishu-error" role="alert">
                  {feishuError}
                </div>
              )}
              <div className="dh-feishu-hint">截断长度即时生效；重新扫码会覆盖现有应用凭据与本 profile 的飞书 hooks。</div>
            </div>
          ) : feishu.setup?.status === 'failed' ? (
            <div className="dh-feishu-status">
              <div className="dh-feishu-error" role="alert">
                连接失败：{feishu.setup.error ?? '未知错误'}
              </div>
              <div className="dh-buttons">
                <button
                  type="button"
                  className="dh-button dh-button-primary"
                  disabled={feishuBusy}
                  onClick={() => void connectFeishu()}
                >
                  {feishuBusy ? '启动中…' : '重试'}
                </button>
              </div>
            </div>
          ) : (
            <div className="dh-feishu-form">
              <div className="dh-test-row">
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
                <button
                  type="button"
                  className="dh-button dh-button-primary"
                  disabled={feishuBusy}
                  onClick={() => void connectFeishu()}
                >
                  {feishuBusy ? '启动扫码…' : '扫码连接飞书'}
                </button>
                {reconnecting && (
                  <button type="button" className="dh-button" onClick={() => setReconnecting(false)}>
                    返回
                  </button>
                )}
              </div>
              {feishuError !== null && (
                <div className="dh-feishu-error" role="alert">
                  {feishuError}
                </div>
              )}
              <div className="dh-feishu-hint">
                将创建名为「DSH 通知机器人」的飞书应用（仅 im:message:send_as_bot 权限），扫码者本人接收通知卡片；配置写入
                ~/.dsh/profiles/&lt;profile&gt;/cordis.patch.yml（支持热加载的 profile 立即生效）。
              </div>
            </div>
          )}
          {configMessage !== null && (
            <div
              className={configMessage.ok ? 'dh-feishu-line dh-feishu-ok' : 'dh-feishu-error'}
              role="status"
            >
              {configMessage.text}
            </div>
          )}
        </div>
      </section>

      <section className="dh-section">
        <div className="dh-section-head">
          <h3 className="dh-section-title">手动测试</h3>
          <button
            type="button"
            className="dh-button dh-toggle"
            aria-expanded={testOpen}
            onClick={() => setTestOpen(!testOpen)}
          >
            {testOpen ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        {testOpen && (
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
                    list="dh-turn-end-reasons"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="completed"
                  />
                  <datalist id="dh-turn-end-reasons">
                    {TURN_END_REASONS.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
              )}
              {(event === 'tool/call' || event === 'tool/result') && (
                <label className="dh-field">
                  <span className="dh-field-label">tool（可选）</span>
                  <input
                    className="dh-input"
                    value={tool}
                    onChange={(e) => setTool(e.target.value)}
                    placeholder="pwsh"
                  />
                </label>
              )}
            </div>
            <details className="dh-advanced">
              <summary>模拟数字字段（可选）</summary>
              <div className="dh-test-row">
                {(
                  [
                    ['runningSubagents', 'runningSubagents', '0'],
                    ['durationMs', 'durationMs', '1200'],
                    ['usageInputTokens', 'usage 输入', '120000'],
                    ['usageOutputTokens', 'usage 输出', '45000'],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label className="dh-field" key={key}>
                    <span className="dh-field-label">{label}</span>
                    <input
                      className="dh-input"
                      value={mockFields[key]}
                      inputMode="numeric"
                      onChange={(e) => setMockFields((current) => ({ ...current, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </label>
                ))}
              </div>
            </details>
            <div className="dh-buttons">
              <button type="button" className="dh-button" disabled={testBusy} onClick={() => void runTest(false)}>
                {testBusy ? '模拟中…' : '模拟（看匹配）'}
              </button>
              <button
                type="button"
                className="dh-button dh-button-primary"
                disabled={testBusy}
                onClick={() => void runTest(true)}
              >
                执行（真实触发）
              </button>
            </div>
            {testError !== null && (
              <div className="dh-error-banner" role="alert">
                测试失败：{testError}
              </div>
            )}
            {testResult !== null && (
              <div className="dh-test-results" role="status">
                <div className="dh-test-line">
                  {testResult.event}：{testResult.matched}/{testResult.total} 个 hook 触发
                  {testResult.executed ? '（已执行）' : ''}
                </div>
                {testResult.fields !== undefined && Object.keys(testResult.fields).length > 0 && (
                  <div className="dh-feishu-hint">
                    模拟上下文：
                    {Object.entries(testResult.fields)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(' · ')}
                  </div>
                )}
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
        )}
      </section>

      <section className="dh-section">
        <div className="dh-section-head">
          <h3 className="dh-section-title">通知渠道测试</h3>
          <button
            type="button"
            className="dh-button dh-toggle"
            aria-expanded={notifyTestOpen}
            onClick={() => setNotifyTestOpen(!notifyTestOpen)}
          >
            {notifyTestOpen ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        {notifyTestOpen && (
          <div className="dh-test-form">
            <div className="dh-test-row">
              <label className="dh-field">
                <span className="dh-field-label">渠道</span>
                <select
                  className="dh-select"
                  value={notifyChannel}
                  onChange={(e) => {
                    setNotifyChannel(e.target.value as NotifyTestChannel)
                    setNotifyChannelPinned(true)
                  }}
                >
                  <option value="webhook">webhook（HTTP JSON）</option>
                  <option value="desktop">desktop（系统通知）</option>
                  {feishu?.configured === true && <option value="feishu">feishu（飞书卡片）</option>}
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
            {notifyChannel === 'feishu' && (
              <div className="dh-feishu-hint">使用「飞书通知」里连接的凭据发送卡片；未连接时这里会报错。</div>
            )}
            <div className="dh-buttons">
              <button
                type="button"
                className="dh-button dh-button-primary"
                disabled={notifyBusy}
                onClick={() => void sendNotifyTest()}
              >
                {notifyBusy ? '发送中…' : '发送测试通知'}
              </button>
            </div>
            {notifyResult !== null && (
              <div role="status">
                <div className={notifyResult.ok ? 'dh-test-line dh-test-line-match' : 'dh-feishu-error'}>
                  {notifyResult.text}
                </div>
                {notifyResult.ok && notifyResult.preview !== undefined && (
                  <div className="dh-feishu-hint">发送内容：{notifyResult.preview}</div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="dh-section" id="dsh-hooks-history">
        <div className="dh-section-head">
          <h3 className="dh-section-title">
            执行历史{status !== null ? ` · 共 ${status.historyCount} 条` : ''}
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
        {historyOpen && (
          <div className="dh-test-row dh-history-filters">
            <label className="dh-field">
              <span className="dh-field-label">事件</span>
              <select
                className="dh-select"
                value={historyFilter.event ?? ''}
                onChange={(e) => setHistoryFilter({ event: e.target.value })}
              >
                <option value="">全部</option>
                {EVENTS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="dh-field">
              <span className="dh-field-label">结果</span>
              <select
                className="dh-select"
                value={historyFilter.outcome ?? ''}
                onChange={(e) => setHistoryFilter({ outcome: e.target.value })}
              >
                <option value="">全部</option>
                {HISTORY_OUTCOMES.map((name) => (
                  <option key={name} value={name}>
                    {outcomeLabel(name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="dh-field">
              <span className="dh-field-label">会话（可选）</span>
              <input
                className="dh-input"
                value={historyFilter.session ?? ''}
                onChange={(e) => setHistoryFilter({ session: e.target.value })}
                placeholder="id 或名称片段"
              />
            </label>
            <label className="dh-check">
              <input
                type="checkbox"
                checked={historyFilter.failed === true}
                onChange={(e) => setHistoryFilter({ failed: e.target.checked })}
              />
              只看失败
            </label>
            {historyFilter.hookIndex !== undefined && (
              <span className="dh-filter-chip">
                hook #{historyFilter.hookIndex}
                <button
                  type="button"
                  aria-label="清除 hook 过滤"
                  onClick={() => setHistoryFilter({ hookIndex: undefined })}
                >
                  ×
                </button>
              </span>
            )}
            <div className="dh-buttons">
              <button
                type="button"
                className="dh-button"
                disabled={!historyFiltered}
                onClick={() => setHistoryFilter({ event: '', outcome: '', session: '', failed: false, hookIndex: undefined })}
              >
                清空过滤
              </button>
              <button
                type="button"
                className="dh-button"
                disabled={(visibleHistory ?? []).length === 0}
                onClick={exportHistory}
              >
                导出 JSONL
              </button>
            </div>
          </div>
        )}
        {historyOpen && historyError && (
          <div className="dh-error-banner" role="alert">
            历史刷新失败{history !== null ? '，显示的是上次成功的数据' : ''}。
            <button type="button" className="dh-button dh-error-retry" onClick={() => void refresh()}>
              重试
            </button>
          </div>
        )}
        {historyOpen && history !== null && history.length > 0 && (
          <div className="dh-history-count">
            显示 {visibleHistory?.length ?? 0} / 最近 {history.length} 条（最多 200 条）
            {historyFiltered ? ' · 已过滤' : ''}
          </div>
        )}
        {historyOpen &&
          (history === null ? (
            historyError ? null : <div className="dh-empty">加载中…</div>
          ) : history.length === 0 ? (
            <div className="dh-empty">暂无记录</div>
          ) : (visibleHistory ?? []).length === 0 ? (
            <div className="dh-empty">没有符合过滤条件的记录</div>
          ) : (
            <div className="dh-timeline">
              {[...(visibleHistory ?? [])].reverse().map((record, index) => (
                <div className="dh-record" key={`${record.ts}-${index}`}>
                  <div className="dh-record-main">
                    <div className="dh-record-top">
                      <span className="dh-record-time">{formatHistoryTime(record.ts)}</span>
                      {record.hookIndex !== undefined && <span className="dh-record-hook">#{record.hookIndex}</span>}
                      <span className="dh-record-event">{record.event}</span>
                      <span className={`dh-outcome ${outcomeClass(record.outcome)}`}>
                        {outcomeLabel(record.outcome)}
                      </span>
                    </div>
                    <div className="dh-record-command" title={record.command}>
                      {record.command}
                    </div>
                    <div className="dh-record-meta">
                      {record.sessionName !== undefined && record.sessionName !== '' && (
                        <span className="dh-record-session">{record.sessionName}</span>
                      )}
                      {record.durationMs !== undefined && <span>耗时 {formatDuration(record.durationMs)}</span>}
                      {record.exitCode !== undefined && <span>退出码 {record.exitCode}</span>}
                    </div>
                    {record.error !== undefined && record.error !== '' && (
                      record.error.length > 120 ? (
                        <details className="dh-record-error-details">
                          <summary>查看错误详情（{record.error.length} 字符）</summary>
                          <div className="dh-record-error">{record.error}</div>
                        </details>
                      ) : (
                        <div className="dh-record-error">{record.error}</div>
                      )
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

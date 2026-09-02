/**
 * /dsh-hooks/* API client for the browser half. Framework-free — every
 * function takes the fetch implementation as an optional last parameter so
 * tests can inject mocks. Envelope errors surface as null + console.warn,
 * never throws: the panel must degrade, not crash.
 */

/** One hook as the status route describes it (string regexes, no secrets). */
export interface HookDescriptor {
  index: number
  on: string
  when?: string
  match?: Record<string, string>
  run?: string
  notify?: { channel: 'webhook' | 'desktop'; url?: string; slack?: boolean }
  input?: 'env' | 'stdin'
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  enabled?: boolean
  cwd?: 'session' | string
  maxConcurrent?: number
  debounceMs?: number
}

/** Wire shape the hook editor saves back (string regexes). */
export interface HookWireSpec {
  on: string
  when?: string
  match?: Record<string, string>
  run?: string
  notify?: { channel: 'webhook' | 'desktop'; url?: string; slack?: boolean } | null
  input?: 'env' | 'stdin'
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  enabled?: boolean
  cwd?: 'session' | string
  maxConcurrent?: number
  debounceMs?: number
}

export interface HookStats {
  inFlight: number
  pendingRetries: number
  recentFailures: number
}

export interface StatusInfo {
  name: string
  version: string
  hookCount: number
  historyCount: number
  hooks: HookDescriptor[]
  stats: HookStats
}

export type HistoryKind = 'run' | 'notify'

export interface HistoryRecord {
  ts: number
  kind: HistoryKind
  event: string
  command: string
  sessionId?: string
  sessionName?: string
  outcome: string
  exitCode?: number
  durationMs?: number
  error?: string
}

export interface TestLine {
  index: number
  matched: boolean
  why: string
  summary: string
}

export interface TestResult {
  event: string
  executed: boolean
  total: number
  matched: number
  lines: TestLine[]
}

interface Envelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

async function getJson<T>(path: string, fetchFn: typeof fetch): Promise<T | null> {
  try {
    const response = await fetchFn(path, { headers: { accept: 'application/json' } })
    if (!response.ok) {
      console.warn(`[dsh-hooks-ui] GET ${path} → HTTP ${response.status}`)
      return null
    }
    const envelope = (await response.json()) as Envelope<T>
    if (!envelope.ok) {
      console.warn(`[dsh-hooks-ui] GET ${path} → ${envelope.error?.message ?? 'unknown error'}`)
      return null
    }
    return envelope.value ?? null
  } catch (error) {
    console.warn(`[dsh-hooks-ui] GET ${path} failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export async function fetchStatus(fetchFn: typeof fetch = fetch): Promise<StatusInfo | null> {
  return getJson<StatusInfo>('/dsh-hooks/status', fetchFn)
}

export async function fetchHistory(n = 50, fetchFn: typeof fetch = fetch): Promise<HistoryRecord[] | null> {
  const capped = Math.max(1, Math.min(500, Math.floor(n)))
  return getJson<HistoryRecord[]>(`/dsh-hooks/history?n=${capped}`, fetchFn)
}

export interface TestRequest {
  event: string
  reason?: string
  tool?: string
  execute?: boolean
}

export async function postTest(body: TestRequest, fetchFn: typeof fetch = fetch): Promise<TestResult | null> {
  try {
    const response = await fetchFn('/dsh-hooks/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const envelope = (await response.json()) as Envelope<TestResult>
    if (!response.ok || !envelope.ok) {
      console.warn(`[dsh-hooks-ui] POST /dsh-hooks/test → ${envelope.error?.message ?? `HTTP ${response.status}`}`)
      return null
    }
    return envelope.value ?? null
  } catch (error) {
    console.warn(`[dsh-hooks-ui] POST /dsh-hooks/test failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

// ---- Feishu connect flow -------------------------------------------------

export type FeishuSetupStatus = 'pending' | 'succeeded' | 'failed'

export interface FeishuSetupSnapshot {
  status: FeishuSetupStatus
  startedAt: number
  expiresAtMs?: number
  qrUrl?: string
  qrDataUrl?: string
  appId?: string
  error?: string
}

export interface FeishuStatusInfo {
  configured: boolean
  appId: string | null
  targetKind: string | null
  target: string | null
  setup: FeishuSetupSnapshot | null
  /** Card content truncation length (characters). */
  resultMaxChars: number
  /** Sample card content truncated at resultMaxChars. */
  preview: string
}

export interface FeishuActionResult {
  ok: boolean
  error?: string
  setup?: FeishuSetupSnapshot
  message?: string
  resultMaxChars?: number
}

/** POST a JSON action and surface the envelope result (error message included). */
async function postFeishu(
  path: string,
  body: Record<string, unknown>,
  fetchFn: typeof fetch,
): Promise<FeishuActionResult> {
  try {
    const response = await fetchFn(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const envelope = (await response.json()) as Envelope<Record<string, unknown>>
    if (!response.ok || !envelope.ok) {
      return { ok: false, error: envelope.error?.message ?? `HTTP ${response.status}` }
    }
    const value = envelope.value ?? {}
    return {
      ok: true,
      setup: value.setup as FeishuSetupSnapshot | undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
      resultMaxChars: typeof value.resultMaxChars === 'number' ? value.resultMaxChars : undefined,
    }
  } catch (error) {
    console.warn(`[dsh-hooks-ui] POST ${path} failed: ${error instanceof Error ? error.message : String(error)}`)
    return { ok: false, error: '网络请求失败' }
  }
}

export async function fetchFeishuStatus(fetchFn: typeof fetch = fetch): Promise<FeishuStatusInfo | null> {
  return getJson<FeishuStatusInfo>('/dsh-hooks/feishu/status', fetchFn)
}

export async function postFeishuSetup(profile: string, resultMaxChars?: number, fetchFn: typeof fetch = fetch): Promise<FeishuActionResult> {
  const body: Record<string, unknown> = { profile }
  if (resultMaxChars !== undefined) body.resultMaxChars = resultMaxChars
  return postFeishu('/dsh-hooks/feishu/setup', body, fetchFn)
}

export async function postFeishuConfig(resultMaxChars: number, fetchFn: typeof fetch = fetch): Promise<FeishuActionResult> {
  return postFeishu('/dsh-hooks/feishu/config', { resultMaxChars }, fetchFn)
}

export async function postFeishuCancel(fetchFn: typeof fetch = fetch): Promise<FeishuActionResult> {
  return postFeishu('/dsh-hooks/feishu/cancel', {}, fetchFn)
}

export async function postFeishuTest(fetchFn: typeof fetch = fetch): Promise<FeishuActionResult> {
  return postFeishu('/dsh-hooks/feishu/test', {}, fetchFn)
}

// ---- hook editor / notify tests / feishu disconnect ----------------------

export interface ActionValue {
  message?: string
  preview?: string
  hookCount?: number
  patchFile?: string
  backupPath?: string
  disconnected?: boolean
  existed?: boolean
  removedHooks?: boolean
}

/** POST a JSON action; returns the envelope value plus its error message. */
async function postValue(
  path: string,
  body: Record<string, unknown>,
  fetchFn: typeof fetch,
): Promise<FeishuActionResult & ActionValue> {
  try {
    const response = await fetchFn(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const envelope = (await response.json()) as Envelope<Record<string, unknown>>
    if (!response.ok || !envelope.ok) {
      return { ok: false, error: envelope.error?.message ?? `HTTP ${response.status}` }
    }
    const value = envelope.value ?? {}
    return {
      ok: true,
      message: typeof value.message === 'string' ? value.message : undefined,
      preview: typeof value.preview === 'string' ? value.preview : undefined,
      hookCount: typeof value.hookCount === 'number' ? value.hookCount : undefined,
      patchFile: typeof value.patchFile === 'string' ? value.patchFile : undefined,
      backupPath: typeof value.backupPath === 'string' ? value.backupPath : undefined,
      disconnected: typeof value.disconnected === 'boolean' ? value.disconnected : undefined,
      existed: typeof value.existed === 'boolean' ? value.existed : undefined,
      removedHooks: typeof value.removedHooks === 'boolean' ? value.removedHooks : undefined,
    }
  } catch (error) {
    console.warn(`[dsh-hooks-ui] POST ${path} failed: ${error instanceof Error ? error.message : String(error)}`)
    return { ok: false, error: '网络请求失败' }
  }
}

export async function postNotifyTest(
  channel: 'webhook' | 'desktop',
  url: string | undefined,
  slack: boolean,
  fetchFn: typeof fetch = fetch,
): Promise<FeishuActionResult & ActionValue> {
  const body: Record<string, unknown> = { channel }
  if (url !== undefined && url !== '') body.url = url
  if (slack) body.slack = true
  return postValue('/dsh-hooks/notify/test', body, fetchFn)
}

export async function postHooksSave(
  profile: string,
  hooks: HookWireSpec[],
  fetchFn: typeof fetch = fetch,
): Promise<FeishuActionResult & ActionValue> {
  return postValue('/dsh-hooks/hooks/save', { profile, hooks }, fetchFn)
}

export async function postFeishuDisconnect(
  profile: string,
  removeHooks: boolean,
  fetchFn: typeof fetch = fetch,
): Promise<FeishuActionResult & ActionValue> {
  return postValue('/dsh-hooks/feishu/disconnect', { profile, removeHooks }, fetchFn)
}

/** `HH:MM:SS` local time for a timestamp. */
export function formatTime(ts: number): string {
  const date = new Date(ts)
  const p = (value: number) => String(value).padStart(2, '0')
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

/** Chinese outcome labels. */
const OUTCOME_LABELS: Record<string, string> = {
  spawned: '已启动',
  'spawn-failed': '启动失败',
  timeout: '超时',
  'exit-0': '成功',
  'exit-nonzero': '失败',
  sent: '已发送',
  'send-failed': '发送失败',
}

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome
}

export type OutcomeTone = 'ok' | 'bad' | 'warn' | 'neutral'

const OUTCOME_TONES: Record<string, OutcomeTone> = {
  'exit-0': 'ok',
  sent: 'ok',
  'exit-nonzero': 'bad',
  'spawn-failed': 'bad',
  'send-failed': 'bad',
  timeout: 'warn',
  spawned: 'neutral',
}

export function outcomeTone(outcome: string): OutcomeTone {
  return OUTCOME_TONES[outcome] ?? 'neutral'
}

/**
 * dry-run: simulate a hook event against a profile's dsh-hooks config and
 * report which hooks would fire (and why the others would not). `--execute`
 * actually runs the matching hooks, for end-to-end verification.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { Config, type HookSpec, type TurnEndReasonKind } from './config.js'
import { matchFilters } from './events.js'
import type { HookContext } from './context.js'
import { DEFAULT_HISTORY_PATH } from './history.js'
import { localDayKey } from './usage.js'
import { createHookRunner } from './runner.js'
import { fireNotify } from './notify.js'

/** Profile patch file for a profile name. */
export function patchFilePath(profile: string): string {
  return join(homedir(), '.dsh', 'profiles', profile, 'cordis.patch.yml')
}

/**
 * Raw `dsh-hooks` config block from a profile's cordis.patch.yml. Throws on a
 * missing/unreadable file — callers that must stay lenient catch it.
 */
function readConfigBlock(file: string): { config?: unknown } {
  if (!existsSync(file)) throw new Error(`未找到 ${file}（profile 不存在或没有 cordis.patch.yml）`)
  let entries: unknown
  try {
    entries = YAML.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error(`cordis.patch.yml 解析失败：${file}`)
  }
  if (!Array.isArray(entries)) throw new Error('cordis.patch.yml 顶层必须是 YAML 数组')
  for (const entry of entries) {
    if (entry !== null && typeof entry === 'object' && (entry as { id?: unknown }).id === 'dsh-hooks') {
      return entry as { config?: unknown }
    }
  }
  throw new Error('cordis.patch.yml 中没有 id: dsh-hooks 的配置块')
}

/**
 * Load and normalize the dsh-hooks config block from a profile's
 * cordis.patch.yml. Runs the block through the Config schema so match
 * regexes compile and invalid entries fail loudly.
 */
export function loadHooks(profile: string, paths: { patchFile?: string } = {}): { hooks: HookSpec[]; source: string } {
  const file = paths.patchFile ?? patchFilePath(profile)
  const block = readConfigBlock(file)
  const rawHooks = (block.config as { hooks?: unknown } | undefined)?.hooks
  const config = Config({ hooks: (Array.isArray(rawHooks) ? rawHooks : []) as HookSpec[] })
  return { hooks: config.hooks ?? [], source: file }
}

/**
 * Resolve the JSONL path a profile's dsh-hooks config writes history to
 * (`config.history.path`, else the plugin default). Deliberately lenient:
 * `tail` must keep working while the config file is missing or mid-edit.
 */
export function loadHistoryPath(profile: string, paths: { patchFile?: string } = {}): string {
  const file = paths.patchFile ?? patchFilePath(profile)
  try {
    const block = readConfigBlock(file)
    const configured = (block.config as { history?: { path?: unknown } } | undefined)?.history?.path
    if (typeof configured === 'string' && configured.trim() !== '') return configured
  } catch {
    // Missing/broken config: fall through to the plugin default.
  }
  return DEFAULT_HISTORY_PATH
}

/**
 * Numeric context fields a simulated event may override — the ones a `match`
 * comparison can meaningfully target. Strings keep their dedicated CLI flag /
 * tester input (`--tool`, `--session-name`, …) and the mock defaults.
 */
export const MOCK_NUMERIC_FIELDS = [
  'turn',
  'step',
  'durationMs',
  'toolDurationMs',
  'runningSubagents',
  'totalSubagents',
  'treeDurationMs',
  'usageTurns',
  'usageSessions',
  'usageInputTokens',
  'usageOutputTokens',
  'usageCacheReadTokens',
  'usageCacheWriteTokens',
  'usageReasoningTokens',
] as const

export type MockNumericField = (typeof MOCK_NUMERIC_FIELDS)[number]

export interface MockFieldsResult {
  ctx: HookContext
  /** Keys that were dropped: unknown field names or non-finite numbers. */
  ignored: string[]
}

/**
 * Apply explicit numeric overrides to a simulated context. Values must be
 * finite numbers; anything else (unknown field, string, NaN) is reported in
 * `ignored` instead of being silently coerced — a tester must never "pass"
 * because a filter was fed the wrong type.
 */
export function applyMockFields(ctx: HookContext, fields: Record<string, unknown> | undefined): MockFieldsResult {
  if (fields === undefined) return { ctx, ignored: [] }
  const next: HookContext = { ...ctx }
  const ignored: string[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (!(MOCK_NUMERIC_FIELDS as readonly string[]).includes(key) || typeof value !== 'number' || !Number.isFinite(value)) {
      ignored.push(key)
      continue
    }
    ;(next as unknown as Record<string, number>)[key] = value
  }
  return { ctx: next, ignored }
}

/** A synthetic context for the simulated event, overridable per field. */
export function mockContext(event: string, overrides: Partial<HookContext> = {}): HookContext {
  const ctx: HookContext = {
    event,
    sessionId: 'dry-run',
    sessionName: 'dry-run 会话',
    cwd: process.cwd(),
    turn: 1,
    step: 1,
    tool: 'pwsh',
    callId: 'dry-run-call',
    content: 'dry-run 模拟内容',
    timestamp: new Date().toISOString(),
  }
  if (event === 'turn/end') {
    // The real turn/end context ALWAYS carries the live subagent count (0 when
    // none are running), so the mock must too — otherwise the documented
    // `match: { runningSubagents: '^0$' }` pattern could never match here.
    ctx.runningSubagents = 0
  }
  if (event === 'usage/daily') {
    // A daily report always describes a day that already ended, and the
    // simulated numbers must be non-zero so `match` filters on them (e.g.
    // `{ usageInputTokens: '>0' }`) are actually exercisable.
    ctx.usageDay = localDayKey(new Date(Date.now() - 86_400_000))
    ctx.usageTurns = 12
    ctx.usageSessions = 3
    ctx.usageInputTokens = 120_000
    ctx.usageOutputTokens = 45_000
    ctx.usageCacheReadTokens = 90_000
    ctx.usageCacheWriteTokens = 6_000
    ctx.usageReasoningTokens = 8_000
  }
  return { ...ctx, ...overrides }
}

export interface DryRunLine {
  /** 1-based hook index in the config. */
  index: number
  matched: boolean
  /** Short reason the hook was skipped (empty when matched). */
  why: string
  /** One-line hook description. */
  summary: string
}

/** Render a match value (regex source, comparison op, or object form). */
function matchText(value: RegExp | { gt?: number; gte?: number; lt?: number; lte?: number; eq?: number }): string {
  if (value instanceof RegExp) return value.source
  return JSON.stringify(value)
}

/** One-line hook description for report rows. */
export function describeHook(hook: HookSpec): string {
  const when = hook.when ? ` when=${hook.when}` : ''
  const match =
    hook.match && Object.keys(hook.match).length > 0
      ? ` match=${JSON.stringify(Object.fromEntries(Object.entries(hook.match).map(([key, re]) => [key, matchText(re)])))},`
      : ''
  const options = [
    hook.enabled === false ? ' enabled:false' : '',
    hook.cwd !== undefined ? ` cwd:${hook.cwd}` : '',
    hook.maxConcurrent !== undefined && hook.maxConcurrent > 0 ? ` maxConcurrent:${hook.maxConcurrent}` : '',
    hook.debounceMs !== undefined && hook.debounceMs > 0 ? ` debounceMs:${hook.debounceMs}` : '',
  ].join('')
  if (hook.run) return `[${hook.on}${when}]${match} run: ${hook.run}${options}`
  if (hook.notify) return `[${hook.on}${when}]${match} notify: ${hook.notify.channel}${hook.notify.url ? ` ${hook.notify.url}` : ''}${options}`
  return `[${hook.on}${when}]${match} (既无 run 也无 notify)${options}`
}

/** Evaluate every hook against the simulated event/context. */
export function evaluateHooks(
  hooks: readonly HookSpec[],
  event: string,
  ctx: HookContext,
  reasonKind?: TurnEndReasonKind,
): DryRunLine[] {
  return hooks.map((hook, index) => {
    const summary = describeHook(hook)
    if (hook.enabled === false) {
      return { index: index + 1, matched: false, why: 'enabled: false（已停用）', summary }
    }
    if (hook.on !== event) {
      return { index: index + 1, matched: false, why: `事件不匹配（${hook.on} ≠ ${event}）`, summary }
    }
    if (event === 'turn/end' && hook.when !== undefined && hook.when !== reasonKind) {
      return { index: index + 1, matched: false, why: `when 不匹配（期望 ${hook.when}，实际 ${reasonKind ?? '无'}）`, summary }
    }
    if (!matchFilters(hook.match, ctx)) {
      return { index: index + 1, matched: false, why: 'match 过滤未通过', summary }
    }
    return { index: index + 1, matched: true, why: '', summary }
  })
}

export interface DryRunOptions {
  profile?: string
  event: string
  reason?: TurnEndReasonKind
  tool?: string
  sessionName?: string
  /** Explicit numeric context overrides (see {@link MOCK_NUMERIC_FIELDS}). */
  fields?: Record<string, unknown>
  /** Actually run the matching hooks (real side effects!). */
  execute?: boolean
  print?: (line: string) => void
  paths?: { patchFile?: string }
}

/** Full dry-run report; optionally executes the matching hooks. */
export async function runDryRun(options: DryRunOptions): Promise<{ matched: number; total: number }> {
  const profile = options.profile ?? 'web'
  const print = options.print ?? console.log
  const { hooks, source } = loadHooks(profile, options.paths)
  const reasonKind = options.reason
  const simulated = applyMockFields(
    mockContext(options.event, {
      reason: reasonKind,
      tool: options.tool,
      sessionName: options.sessionName,
    }),
    options.fields,
  )
  const ctx = simulated.ctx

  print('dsh-hooks dry-run')
  print(`配置来源：${source}（${hooks.length} 个 hook）`)
  print(`模拟事件：${options.event}${reasonKind ? `（reason=${reasonKind}）` : ''}`)
  if (options.fields !== undefined && Object.keys(options.fields).length > 0) {
    const applied = Object.keys(options.fields).filter((key) => !simulated.ignored.includes(key))
    if (applied.length > 0) print(`模拟字段：${applied.map((key) => `${key}=${String(options.fields?.[key])}`).join(', ')}`)
  }
  if (simulated.ignored.length > 0) {
    print(`⚠ 已忽略无法模拟的字段：${simulated.ignored.join(', ')}（可用：${MOCK_NUMERIC_FIELDS.join(' / ')}）`)
  }
  const lines = evaluateHooks(hooks, options.event, ctx, reasonKind)
  for (const line of lines) {
    print(line.matched ? `✅ [${line.index}] ${line.summary}` : `⏭ [${line.index}] ${line.summary} —— ${line.why}`)
  }

  const matched = lines.filter((line) => line.matched)
  if (options.execute) {
    if (matched.length === 0) {
      print('没有匹配的 hook 可执行')
    }
    const runner = createHookRunner((line) => print(`  ${line}`))
    for (const line of matched) {
      const hook = hooks[line.index - 1]
      if (hook.run) {
        print(`▶ 执行 [${line.index}] ${describeHook(hook)}`)
        const outcome = runner.run(hook, ctx)
        if (!outcome.ok) print(`  ✗ ${outcome.reason}${outcome.detail ? `: ${outcome.detail}` : ''}`)
      } else if (hook.notify) {
        print(`▶ 发送 [${line.index}] notify:${hook.notify.channel}`)
        await fireNotify(hook.notify, ctx, undefined, { retries: hook.retries, retryDelayMs: hook.retryDelayMs })
      }
    }
    print('（run 命令 fire-and-forget：执行结果见 dsh 日志）')
  } else if (matched.length > 0) {
    print(`共 ${matched.length} 个 hook 会触发。加 --execute 实际执行（真实副作用！）`)
  }

  return { matched: matched.length, total: hooks.length }
}

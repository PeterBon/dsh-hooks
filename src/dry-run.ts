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
import { createHookRunner } from './runner.js'
import { fireNotify } from './notify.js'

/** Profile patch file for a profile name. */
export function patchFilePath(profile: string): string {
  return join(homedir(), '.dsh', 'profiles', profile, 'cordis.patch.yml')
}

/**
 * Load and normalize the dsh-hooks config block from a profile's
 * cordis.patch.yml. Runs the block through the Config schema so match
 * regexes compile and invalid entries fail loudly.
 */
export function loadHooks(profile: string, paths: { patchFile?: string } = {}): { hooks: HookSpec[]; source: string } {
  const file = paths.patchFile ?? patchFilePath(profile)
  if (!existsSync(file)) throw new Error(`未找到 ${file}（profile 不存在或没有 cordis.patch.yml）`)
  let entries: unknown
  try {
    entries = YAML.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error(`cordis.patch.yml 解析失败：${file}`)
  }
  if (!Array.isArray(entries)) throw new Error('cordis.patch.yml 顶层必须是 YAML 数组')
  let block: { config?: unknown } | undefined
  for (const entry of entries) {
    if (entry !== null && typeof entry === 'object' && (entry as { id?: unknown }).id === 'dsh-hooks') {
      block = entry as { config?: unknown }
      break
    }
  }
  if (block === undefined) throw new Error('cordis.patch.yml 中没有 id: dsh-hooks 的配置块')
  const rawHooks = (block.config as { hooks?: unknown } | undefined)?.hooks
  const config = Config({ hooks: (Array.isArray(rawHooks) ? rawHooks : []) as HookSpec[] })
  return { hooks: config.hooks ?? [], source: file }
}

/** A synthetic context for the simulated event, overridable per field. */
export function mockContext(event: string, overrides: Partial<HookContext> = {}): HookContext {
  return {
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
    ...overrides,
  }
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

/** One-line hook description for report rows. */
export function describeHook(hook: HookSpec): string {
  const when = hook.when ? ` when=${hook.when}` : ''
  const match =
    hook.match && Object.keys(hook.match).length > 0
      ? ` match=${JSON.stringify(Object.fromEntries(Object.entries(hook.match).map(([key, re]) => [key, re.source])))},`
      : ''
  if (hook.run) return `[${hook.on}${when}]${match} run: ${hook.run}`
  if (hook.notify) return `[${hook.on}${when}]${match} notify: ${hook.notify.channel}${hook.notify.url ? ` ${hook.notify.url}` : ''}`
  return `[${hook.on}${when}]${match} (既无 run 也无 notify)`
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
  const ctx = mockContext(options.event, {
    reason: reasonKind,
    tool: options.tool,
    sessionName: options.sessionName,
  })

  print('dsh-hooks dry-run')
  print(`配置来源：${source}（${hooks.length} 个 hook）`)
  print(`模拟事件：${options.event}${reasonKind ? `（reason=${reasonKind}）` : ''}`)
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
        await fireNotify(hook.notify, ctx)
      }
    }
    print('（run 命令 fire-and-forget：执行结果见 dsh 日志）')
  } else if (matched.length > 0) {
    print(`共 ${matched.length} 个 hook 会触发。加 --execute 实际执行（真实副作用！）`)
  }

  return { matched: matched.length, total: hooks.length }
}

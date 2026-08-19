/**
 * Feishu QR-scan session manager for the web routes: one in-flight
 * `registerApp` flow at a time, polled by the settings card. The start
 * promise resolves as soon as the QR authorization is ready (so the UI can
 * render the code immediately), while the scan wait and file writes finish
 * in the background and surface through `status()`.
 */
import { runFeishuSetup, type FeishuSetupPaths } from './feishu.js'

export type FeishuSetupStatus = 'pending' | 'succeeded' | 'failed'

/** Display-only snapshot; credentials never enter any field. */
export interface FeishuSetupSnapshot {
  status: FeishuSetupStatus
  /** Epoch ms when the flow started (server clock). */
  startedAt: number
  /** Epoch ms when the QR authorization expires (pending only). */
  expiresAtMs?: number
  /** Feishu authorization URL (pending only). */
  qrUrl?: string
  /** PNG data URL of the QR code (pending only; best-effort). */
  qrDataUrl?: string
  /** Created app id (succeeded only, unmasked — it is not a secret). */
  appId?: string
  /** Failure message (failed only). */
  error?: string
}

export const FEISHU_SETUP_BUSY = '已有进行中的扫码会话，请先取消或等待完成'

/** Render the QR as a PNG data URL (the qrcode package loads lazily). */
export async function renderFeishuQr(url: string): Promise<string> {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(url, { width: 320, margin: 1 })
}

export interface FeishuSetupManagerDeps {
  runSetup?: typeof runFeishuSetup
  renderQr?: (url: string) => Promise<string>
  /** Clock override for tests. */
  now?: () => number
  paths?: FeishuSetupPaths
}

export interface FeishuSetupManager {
  /** Start one scan flow; rejects when another flow is still pending. */
  start(profile?: string, options?: { resultMaxChars?: number }): Promise<FeishuSetupSnapshot>
  /** Current snapshot, or null when idle. */
  status(): FeishuSetupSnapshot | null
  /** Abort the pending flow. Returns false when nothing was pending. */
  cancel(): boolean
  dispose(): void
}

export function createFeishuSetupManager(deps: FeishuSetupManagerDeps = {}): FeishuSetupManager {
  const runSetup = deps.runSetup ?? runFeishuSetup
  const renderQr = deps.renderQr ?? renderFeishuQr
  const now = deps.now ?? Date.now
  const paths = deps.paths

  let current: FeishuSetupSnapshot | null = null
  let controller: AbortController | null = null
  let cancelled = false

  async function start(profile = 'web', options: { resultMaxChars?: number } = {}): Promise<FeishuSetupSnapshot> {
    if (current?.status === 'pending') throw new Error(FEISHU_SETUP_BUSY)

    cancelled = false
    const ac = new AbortController()
    controller = ac
    const signal = ac.signal
    const startedAt = now()
    const snapshot: FeishuSetupSnapshot = { status: 'pending', startedAt }
    current = snapshot

    let resolveReady!: (snapshot: FeishuSetupSnapshot) => void
    const ready = new Promise<FeishuSetupSnapshot>((resolve) => {
      resolveReady = resolve
    })

    const task = (async () => {
      try {
        const result = await runSetup({
          profile,
          signal,
          paths,
          resultMaxChars: options.resultMaxChars,
          onQRCodeReady: async (qr) => {
            snapshot.qrUrl = qr.url
            snapshot.expiresAtMs = startedAt + qr.expireIn * 1000
            try {
              snapshot.qrDataUrl = await renderQr(qr.url)
            } catch {
              // QR 图像渲染失败不阻塞扫码：UI 回退为授权链接。
            }
            resolveReady({ ...snapshot })
          },
        })
        if (cancelled) return
        current = { status: 'succeeded', startedAt, appId: result.appId }
      } catch (error) {
        if (cancelled) return
        current = {
          status: 'failed',
          startedAt,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })()

    // Resolve when the QR is ready; if the flow settles first (no QR callback
    // or an immediate failure), report the terminal snapshot instead.
    const cancelledOutcome: FeishuSetupSnapshot = { status: 'failed', startedAt, error: '已取消' }
    return await Promise.race([
      ready,
      task.then(() => current ?? cancelledOutcome),
    ])
  }

  function status(): FeishuSetupSnapshot | null {
    return current
  }

  function cancel(): boolean {
    if (current?.status !== 'pending') return false
    cancelled = true
    controller?.abort()
    controller = null
    current = null
    return true
  }

  function dispose(): void {
    cancel()
  }

  return { start, status, cancel, dispose }
}

import { describe, expect, it, vi } from 'vitest'
import { createFeishuSetupManager, FEISHU_SETUP_BUSY } from '../src/feishu-session.js'

/** A runSetup fake whose completion the test controls through `gate`. */
function controlledRun({ qr = true } = {}) {
  let resolveGate!: () => void
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve
  })
  const captured: { signal?: AbortSignal } = {}
  const runSetup = vi.fn(async (options: { signal?: AbortSignal; onQRCodeReady?: (qr: { url: string; expireIn: number }) => void | Promise<void> }) => {
    captured.signal = options.signal
    if (qr) await options.onQRCodeReady?.({ url: 'https://passport.feishu.cn/auth', expireIn: 60 })
    await gate
    return { appId: 'cli_new_app', ownerOpenId: 'ou_owner' }
  })
  return { runSetup, resolveGate, captured }
}

const renderQr = vi.fn(async (url: string) => `data:image/png;base64,QR(${url})`)

describe('createFeishuSetupManager', () => {
  it('resolves start with the pending snapshot once the QR is ready', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr, now: () => 1000 })
    const snapshot = await manager.start('web')
    expect(snapshot).toMatchObject({
      status: 'pending',
      startedAt: 1000,
      qrUrl: 'https://passport.feishu.cn/auth',
      qrDataUrl: 'data:image/png;base64,QR(https://passport.feishu.cn/auth)',
      expiresAtMs: 1000 + 60 * 1000,
    })
    expect(manager.status()).toMatchObject({ status: 'pending' })
    resolveGate()
  })

  it('settles to succeeded with the app id after the scan flow finishes', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr, now: () => 0 })
    await manager.start('web')
    resolveGate()
    await vi.waitFor(() => expect(manager.status()).toMatchObject({ status: 'succeeded', appId: 'cli_new_app' }))
  })

  it('settles to failed when the setup flow rejects', async () => {
    const runSetup = vi.fn(async () => {
      throw new Error('扫码超时')
    })
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web')
    await vi.waitFor(() => expect(manager.status()).toMatchObject({ status: 'failed', error: '扫码超时' }))
  })

  it('passes the truncation length through to the setup flow', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web', { resultMaxChars: 700 })
    expect(runSetup).toHaveBeenCalledWith(expect.objectContaining({ profile: 'web', resultMaxChars: 700 }))
    resolveGate()
  })

  it('rejects a second start while one scan session is pending', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web')
    await expect(manager.start('web')).rejects.toThrow(FEISHU_SETUP_BUSY)
    resolveGate()
  })

  it('cancel aborts the in-flight flow and clears the snapshot', async () => {
    const { runSetup, captured, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web')
    expect(manager.cancel()).toBe(true)
    expect(captured.signal?.aborted).toBe(true)
    expect(manager.status()).toBeNull()
    expect(manager.cancel()).toBe(false)
    resolveGate()
  })

  it('allows a fresh start after a previous flow succeeded', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web')
    resolveGate()
    await vi.waitFor(() => expect(manager.status()).toMatchObject({ status: 'succeeded' }))
    await expect(manager.start('web')).resolves.toMatchObject({ status: 'pending' })
  })

  it('survives a QR render failure (qrUrl still resolves start)', async () => {
    const { runSetup, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr: async () => { throw new Error('render failed') } })
    const snapshot = await manager.start('web')
    expect(snapshot.qrUrl).toBe('https://passport.feishu.cn/auth')
    expect(snapshot.qrDataUrl).toBeUndefined()
    resolveGate()
  })

  it('dispose cancels a pending session', async () => {
    const { runSetup, captured, resolveGate } = controlledRun()
    const manager = createFeishuSetupManager({ runSetup, renderQr })
    await manager.start('web')
    manager.dispose()
    expect(captured.signal?.aborted).toBe(true)
    expect(manager.status()).toBeNull()
    resolveGate()
  })
})

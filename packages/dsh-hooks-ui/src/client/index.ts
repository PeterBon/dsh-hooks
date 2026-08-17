/**
 * @PeterBon/dsh-hooks-ui — browser half: sidebar entry + drawer dashboard
 * over the core plugin's /dsh-hooks/* routes. Failure policy matches the
 * task-board precedent: DOM mounting problems are logged, never thrown —
 * a plugin apply that throws fails the whole web shell boot.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { mountPanel } from './panel-mount.tsx'
import { mountSidebarEntry } from './sidebar-entry.ts'

export const name = '@PeterBon/dsh-hooks-ui'

/** Single-application guard: first apply wins; later calls become no-ops. */
let applied = false

export function apply(ctx: ClientContext): void {
  if (typeof document === 'undefined') return
  if (applied) return
  applied = true

  try {
    const panel = mountPanel()
    const disposeEntry = mountSidebarEntry({ toggle: panel.toggle })
    ctx.effect(() => () => {
      applied = false
      disposeEntry()
      panel.dispose()
    }, 'dsh-hooks-ui: panel')
  } catch (error) {
    console.error('[dsh-hooks-ui] mount failed:', error)
  }
}

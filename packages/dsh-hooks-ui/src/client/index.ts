/**
 * @PeterBon/dsh-hooks-ui — browser half: a settings card registered into the
 * shell's `web-ui.plugin.item` slot (official slot API, no DOM hacks). The
 * card shows the core plugin's status, the execution-history timeline, and a
 * manual event tester, all served by the core's /dsh-hooks/* routes.
 *
 * Failure policy matches the task-board precedent: registration problems are
 * logged, never thrown — a plugin apply that throws fails the whole web
 * shell boot.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { HooksSettingsCard } from './settings-card.tsx'
import cardCss from './settings-card.module.css?inline'

export const name = '@PeterBon/dsh-hooks-ui'

/** Required services: the slot registry must be up before this plugin applies. */
export const inject = ['slots'] as const

const STYLE_ID = 'dsh-hooks-ui-style'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group. Spelled with the same shape as the task-board plugin so
     * this package can register without depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Single-application guard: first apply wins; later calls become no-ops. */
let applied = false

export function apply(ctx: ClientContext): void {
  if (typeof document === 'undefined') return
  if (applied) return
  applied = true

  injectCardStyle()

  try {
    ctx.slots.inject('web-ui.plugin.item', () => {
      const unregister = ctx.slots.register(
        {
          name: 'web-ui.plugin.item',
          id: 'dsh-hooks',
          order: 120,
          label: 'Hooks',
        },
        HooksSettingsCard,
      )
      return () => {
        unregister()
      }
    })
  } catch (error) {
    console.error('[dsh-hooks-ui] slot registration failed:', error)
  }

  ctx.effect(() => () => {
    applied = false
    document.getElementById(STYLE_ID)?.remove()
  }, 'dsh-hooks-ui: card')
}

/** Inject the card stylesheet once (bundled as a string via .css?inline). */
function injectCardStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cardCss
  document.head.appendChild(style)
}

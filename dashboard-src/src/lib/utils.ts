import clsx, { type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import type { GroupInfo, GroupKind, Instance, SessionState } from './types'

/**
 * Tailwind emits utilities in its own fixed order, so a class passed later via
 * `className` does NOT reliably beat one baked into a component — `.w-full`
 * happens to be emitted after `.w-auto`, so plain concatenation silently loses
 * the override. tailwind-merge drops the conflicting class instead of relying
 * on source order.
 *
 * The custom colours from @theme have to be declared or twMerge treats e.g.
 * `text-down` as an unknown class and keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'bg',
        'bg-sunk',
        'surface',
        'surface-2',
        'line',
        'line-strong',
        'text',
        'muted',
        'faint',
        'accent',
        'accent-hover',
        'accent-contrast',
        'accent-soft',
        'up',
        'up-soft',
        'pairing',
        'pairing-soft',
        'down',
        'down-soft',
      ],
      font: ['display', 'sans', 'mono'],
      shadow: ['card', 'pop'],
    },
  },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/**
 * `connected` means the websocket is up; `loggedIn` means WhatsApp accepted the
 * device. A session that is connected but not logged in is sitting on a QR code
 * waiting for someone to scan it — operationally very different from "offline".
 */
export function sessionState(instance: Pick<Instance, 'connected' | 'loggedIn'>): SessionState {
  if (instance.connected && instance.loggedIn) return 'online'
  if (instance.connected) return 'pairing'
  return 'offline'
}

export const STATE_LABEL: Record<SessionState, string> = {
  online: 'Online',
  pairing: 'Aguardando leitura',
  offline: 'Offline',
}

export const STATE_SHORT: Record<SessionState, string> = {
  online: 'online',
  pairing: 'aguardando',
  offline: 'offline',
}

/** Tailwind fragments per state, so status colour is defined in exactly one place. */
export const STATE_STYLES: Record<
  SessionState,
  { text: string; bg: string; dot: string; bar: string; ring: string }
> = {
  online: {
    text: 'text-up',
    bg: 'bg-up-soft',
    dot: 'bg-up',
    bar: 'bg-up',
    ring: 'text-up',
  },
  pairing: {
    text: 'text-pairing',
    bg: 'bg-pairing-soft',
    dot: 'bg-pairing',
    bar: 'bg-pairing',
    ring: 'text-pairing',
  },
  offline: {
    text: 'text-down',
    bg: 'bg-down-soft',
    dot: 'bg-down',
    bar: 'bg-down',
    ring: 'text-down',
  },
}

/** Strips the @s.whatsapp.net / @g.us suffix and the :device part of a JID. */
export function jidToPhone(jid?: string): string {
  if (!jid) return ''
  return jid.split('@')[0].split(':')[0]
}

export function normalizePhoneJid(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('@s.whatsapp.net') || trimmed.endsWith('@g.us')) return trimmed
  return `${trimmed.split('@')[0].replace(/\D/g, '')}@s.whatsapp.net`
}

/** Best-effort pretty print for Brazilian and international numbers. */
export function formatPhone(raw: string): string {
  const digits = jidToPhone(raw).replace(/\D/g, '')
  if (!digits) return raw
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const half = rest.length === 9 ? 5 : 4
    return `+55 (${ddd}) ${rest.slice(0, half)}-${rest.slice(half)}`
  }
  return `+${digits}`
}

export function groupKind(group: GroupInfo): GroupKind {
  if (group.IsParent) return 'community'
  if (group.LinkedParentJID) return 'community_group'
  return 'group'
}

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  group: 'Grupo',
  community: 'Comunidade',
  community_group: 'Grupo da comunidade',
}

export function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatRelative(timestamp: number | null): string {
  if (!timestamp) return 'nunca'
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'agora'
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  return `há ${Math.round(minutes / 60)}h`
}

/** WhatsApp caps group subjects at 25 characters, mirrored in the forms. */
export const GROUP_NAME_MAX = 25

export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value
  const side = Math.floor((max - 1) / 2)
  return `${value.slice(0, side)}…${value.slice(-side)}`
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 100)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context; plain-HTTP deployments fall back.
    try {
      const helper = document.createElement('textarea')
      helper.value = text
      helper.setAttribute('readonly', '')
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      const ok = document.execCommand('copy')
      helper.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

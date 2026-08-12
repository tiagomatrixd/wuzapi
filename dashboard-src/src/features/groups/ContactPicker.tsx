import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Users } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import { Button, Input, Spinner } from '../../components/ui/primitives'
import { cn, formatPhone, jidToPhone } from '../../lib/utils'

export interface PickedContact {
  phone: string
  name: string
}

/**
 * Contacts come from the phone's own address book, which can be thousands of
 * entries — so this is a searchable list with a selected-first ordering rather
 * than a dropdown. Numbers can also be typed in directly, since a contact does
 * not have to be saved to be added to a group.
 */
export function ContactPicker({
  selected,
  onChange,
  exclude = [],
}: {
  selected: PickedContact[]
  onChange: (next: PickedContact[]) => void
  /** Phone numbers already in the group, hidden from the list. */
  exclude?: string[]
}) {
  const toast = useToast()
  const [contacts, setContacts] = useState<PickedContact[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const excluded = useMemo(() => new Set(exclude.map(jidToPhone)), [exclude])
  const selectedPhones = useMemo(
    () => new Set(selected.map((contact) => contact.phone)),
    [selected],
  )

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.contacts()
      const rows = Object.entries(data ?? {})
        .map(([jid, contact]) => ({
          phone: jidToPhone(jid),
          name: contact.FullName || contact.PushName || '',
        }))
        .filter((contact) => contact.phone && !excluded.has(contact.phone))
        .sort((a, b) => (a.name || a.phone).localeCompare(b.name || b.phone, 'pt-BR'))

      setContacts(rows)
      if (rows.length === 0) toast.info('Nenhum contato sincronizado nesta sessão.')
    } catch (error) {
      toast.error(errorMessage(error))
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  // Load once when the picker first appears.
  useEffect(() => {
    if (contacts === null && !loading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (contact: PickedContact) => {
    onChange(
      selectedPhones.has(contact.phone)
        ? selected.filter((item) => item.phone !== contact.phone)
        : [...selected, contact],
    )
  }

  const typed = query.replace(/\D/g, '')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = contacts ?? []
    const filtered = needle
      ? rows.filter(
          (contact) =>
            contact.name.toLowerCase().includes(needle) || contact.phone.includes(typed),
        )
      : rows
    // Keep the selection pinned to the top so it never scrolls out of sight.
    return [...filtered].sort((a, b) => {
      const delta = Number(selectedPhones.has(b.phone)) - Number(selectedPhones.has(a.phone))
      return delta !== 0 ? delta : 0
    })
  }, [contacts, query, typed, selectedPhones])

  const canAddTyped =
    typed.length >= 10 &&
    !selectedPhones.has(typed) &&
    !excluded.has(typed) &&
    !(contacts ?? []).some((contact) => contact.phone === typed)

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar contato ou digitar um número"
          className="h-9 pl-8 text-[13px]"
          aria-label="Buscar contato"
        />
      </div>

      {canAddTyped && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            onChange([...selected, { phone: typed, name: '' }])
            setQuery('')
          }}
        >
          Adicionar {formatPhone(typed)}
        </Button>
      )}

      <div className="h-56 overflow-y-auto rounded-lg border border-line bg-surface">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Users className="size-5 text-faint" aria-hidden />
            <p className="text-[13px] text-muted">
              {contacts === null || contacts.length === 0
                ? 'Nenhum contato disponível. Digite o número completo acima.'
                : `Nenhum contato para “${query}”.`}
            </p>
            {contacts !== null && contacts.length === 0 && (
              <Button size="sm" onClick={load}>
                Recarregar contatos
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {visible.map((contact) => {
              const active = selectedPhones.has(contact.phone)
              return (
                <li key={contact.phone}>
                  <button
                    type="button"
                    onClick={() => toggle(contact)}
                    aria-pressed={active}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded border transition-colors',
                        active
                          ? 'border-accent bg-accent text-accent-contrast'
                          : 'border-line-strong',
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text">
                        {contact.name || formatPhone(contact.phone)}
                      </span>
                      {contact.name && (
                        <span className="tnum block truncate text-[11px] text-faint">
                          {formatPhone(contact.phone)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted">
        {selected.length === 0
          ? 'Nenhum participante selecionado.'
          : `${selected.length} ${selected.length === 1 ? 'selecionado' : 'selecionados'}.`}
      </p>
    </div>
  )
}

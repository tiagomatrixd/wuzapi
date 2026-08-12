import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RadioTower, Search, SearchX, X } from 'lucide-react'
import { useAuth } from '../app/auth'
import { api, errorMessage } from '../lib/api'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/ui/Toast'
import { Button, EmptyState, Input, Select, Skeleton } from '../components/ui/primitives'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { FleetBar, type FleetCounts } from '../components/FleetBar'
import { SessionTable } from '../features/sessions/SessionTable'
import { SessionCardList } from '../features/sessions/SessionCard'
import { AddInstanceModal } from '../features/sessions/AddInstanceModal'
import type { SessionActions } from '../features/sessions/actions'
import type { Instance, SessionState } from '../lib/types'
import { copyToClipboard, jidToPhone, sessionState } from '../lib/utils'

type Sort = 'attention' | 'name' | 'name-desc'

/** Offline first: the board should lead with whatever needs a human. */
const ATTENTION_ORDER: Record<SessionState, number> = { offline: 0, pairing: 1, online: 2 }

export function Sessions({ onOpenInstance }: { onOpenInstance: (instance: Instance) => void }) {
  const { role } = useAuth()
  const toast = useToast()
  const isAdmin = role === 'admin'

  const { data, error, loading, lastUpdated, refresh } = usePolling(
    useCallback(() => api.listInstances(), []),
    5000,
  )

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SessionState | 'all'>('all')
  const [sort, setSort] = useState<Sort>('attention')
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Instance | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // "/" focuses search, the way every console the operator already uses works.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const instances = useMemo(() => data ?? [], [data])

  const counts = useMemo<FleetCounts>(() => {
    const result: FleetCounts = { online: 0, pairing: 0, offline: 0, total: instances.length }
    for (const instance of instances) result[sessionState(instance)] += 1
    return result
  }, [instances])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matched = instances.filter((instance) => {
      if (filter !== 'all' && sessionState(instance) !== filter) return false
      if (!needle) return true
      // Search everything an operator might paste in: name, id, number, token, webhook.
      return [
        instance.name,
        instance.id,
        instance.jid,
        jidToPhone(instance.jid),
        instance.token,
        instance.webhook,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })

    return matched.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'name-desc') return b.name.localeCompare(a.name, 'pt-BR')
      const delta = ATTENTION_ORDER[sessionState(a)] - ATTENTION_ORDER[sessionState(b)]
      return delta !== 0 ? delta : a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [instances, query, filter, sort])

  const withBusy = useCallback(
    async (id: string, task: () => Promise<unknown>, success: string) => {
      setBusy((current) => new Set(current).add(id))
      try {
        await task()
        toast.success(success)
        await refresh()
      } catch (caught) {
        toast.error(errorMessage(caught))
      } finally {
        setBusy((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
      }
    },
    [refresh, toast],
  )

  const actions = useMemo<SessionActions>(
    () => ({
      busy,
      open: onOpenInstance,
      connect: (instance) =>
        withBusy(instance.id, () => api.connect(instance.token), `Conectando “${instance.name}”.`),
      disconnect: (instance) =>
        withBusy(
          instance.id,
          () => api.disconnect(instance.token),
          `“${instance.name}” desconectada.`,
        ),
      logout: (instance) =>
        withBusy(
          instance.id,
          () => api.logout(instance.token),
          `Sessão do WhatsApp encerrada em “${instance.name}”.`,
        ),
      remove: (instance) => setPendingDelete(instance),
      copy: async (value, label) => {
        if (await copyToClipboard(value)) toast.success(label)
        else toast.error('Não foi possível copiar.')
      },
    }),
    [busy, onOpenInstance, withBusy, toast],
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await api.deleteInstance(pendingDelete.id)
      toast.success(`Instância “${pendingDelete.name}” excluída.`)
      setPendingDelete(null)
      await refresh()
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  const manualRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const filtering = Boolean(query.trim()) || filter !== 'all'

  return (
    <div className="space-y-4 sm:space-y-5">
      <FleetBar
        counts={counts}
        filter={filter}
        onFilter={setFilter}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={manualRefresh}
      />

      {error && (
        <p className="rounded-lg border border-down/30 bg-down-soft px-3.5 py-2.5 text-[13px] text-down">
          {error} Mostrando os últimos dados recebidos.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, ID, número, token ou webhook"
            aria-label="Buscar sessões"
            className="pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-faint transition-colors hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
          aria-label="Ordenar sessões"
          className="w-auto"
        >
          <option value="attention">Precisam de atenção</option>
          <option value="name">Nome (A–Z)</option>
          <option value="name-desc">Nome (Z–A)</option>
        </Select>

        {isAdmin && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Nova instância</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        )}
      </div>

      {loading && instances.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          {filtering ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma sessão encontrada"
              description="Nenhuma instância corresponde à busca ou ao filtro de status aplicado."
              action={
                <Button
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                >
                  Limpar busca e filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={RadioTower}
              title="Nenhuma instância ainda"
              description="Crie a primeira instância para conectar um número de WhatsApp a esta API."
              action={
                isAdmin ? (
                  <Button variant="primary" onClick={() => setAdding(true)}>
                    <Plus className="size-4" aria-hidden />
                    Criar instância
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <>
          <SessionTable instances={visible} actions={actions} isAdmin={isAdmin} />
          <SessionCardList instances={visible} actions={actions} isAdmin={isAdmin} />
          <p className="text-center text-xs text-faint">
            {filtering
              ? `${visible.length} de ${instances.length} ${instances.length === 1 ? 'sessão' : 'sessões'}`
              : `${instances.length} ${instances.length === 1 ? 'sessão' : 'sessões'}`}
          </p>
        </>
      )}

      <AddInstanceModal open={adding} onClose={() => setAdding(false)} onCreated={refresh} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir instância"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” será removida junto com o registro do dispositivo no WhatsApp. O número precisará ser pareado de novo. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir instância"
        confirmPhrase={pendingDelete?.name}
        destructive
      />
    </div>
  )
}

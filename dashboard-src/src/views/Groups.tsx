import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Timer,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Badge, Button, EmptyState, Input, Select, Skeleton } from '../components/ui/primitives'
import { CreateGroupModal } from '../features/groups/CreateGroupModal'
import { JoinGroupModal } from '../features/groups/JoinGroupModal'
import { GroupDetailsModal } from '../features/groups/GroupDetailsModal'
import { GROUP_KIND_LABEL, cn, groupKind } from '../lib/utils'
import type { GroupInfo, GroupKind } from '../lib/types'

type Filter = GroupKind | 'all'

export function Groups({ selfJid }: { selfJid: string }) {
  const toast = useToast()
  const [groups, setGroups] = useState<GroupInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<GroupInfo | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const result = await api.listGroups()
        setGroups(result?.Groups ?? [])
        setError('')
      } catch (caught) {
        setError(errorMessage(caught))
        if (!silent) setGroups([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Groups are fetched on demand, not polled: the server caches this list and a
  // refresh can hit WhatsApp directly, so a 5s poll would be abusive.
  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (groups ?? [])
      .filter((group) => {
        if (filter !== 'all' && groupKind(group) !== filter) return false
        if (!needle) return true
        return (
          group.Name?.toLowerCase().includes(needle) ||
          group.Topic?.toLowerCase().includes(needle) ||
          group.JID?.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? '', 'pt-BR'))
  }, [groups, query, filter])

  const refresh = async () => {
    await load(true)
    toast.success('Lista de grupos atualizada.')
  }

  const filtering = Boolean(query.trim()) || filter !== 'all'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar grupo por nome, descrição ou JID"
            aria-label="Buscar grupos"
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
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          aria-label="Filtrar por tipo"
          className="w-auto"
        >
          <option value="all">Todos os tipos</option>
          <option value="group">Grupos</option>
          <option value="community">Comunidades</option>
          <option value="community_group">Grupos de comunidade</option>
        </Select>

        <Button onClick={refresh} size="icon" title="Atualizar lista" aria-label="Atualizar lista">
          <RefreshCw className={cn('size-4', loading && 'animate-spin-slow')} aria-hidden />
        </Button>

        <Button onClick={() => setJoining(true)}>
          <UserPlus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Entrar</span>
        </Button>

        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Criar grupo</span>
          <span className="sm:hidden">Criar</span>
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-down/30 bg-down-soft px-3.5 py-2.5 text-[13px] text-down">
          {error}
        </p>
      )}

      {loading && groups === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface shadow-card">
          {filtering ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum grupo encontrado"
              description="Nenhum grupo corresponde à busca ou ao tipo selecionado."
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
              icon={Users}
              title="Nenhum grupo ainda"
              description="Esta sessão não participa de nenhum grupo. Crie um ou entre por convite."
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setJoining(true)}>Entrar por convite</Button>
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    Criar grupo
                  </Button>
                </div>
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((group) => {
              const kind = groupKind(group)
              return (
                <button
                  key={group.JID}
                  type="button"
                  onClick={() => setSelected(group)}
                  className="group flex flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:border-line-strong hover:shadow-pop"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:text-accent">
                      <Users className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text">{group.Name || 'Sem nome'}</p>
                      <p className="tnum text-[13px] text-muted">
                        {group.Participants?.length ?? 0}{' '}
                        {group.Participants?.length === 1 ? 'participante' : 'participantes'}
                      </p>
                    </div>
                  </div>

                  {group.Topic && (
                    <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                      {group.Topic}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {kind !== 'group' && <Badge tone="accent">{GROUP_KIND_LABEL[kind]}</Badge>}
                    {group.IsAnnounce && (
                      <Badge>
                        <Megaphone className="size-2.5" aria-hidden />
                        só admins
                      </Badge>
                    )}
                    {group.IsLocked && (
                      <Badge>
                        <Lock className="size-2.5" aria-hidden />
                        travado
                      </Badge>
                    )}
                    {Boolean(group.DisappearingTimer) && (
                      <Badge>
                        <Timer className="size-2.5" aria-hidden />
                        temporárias
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <p className="text-center text-xs text-faint">
            {filtering
              ? `${visible.length} de ${groups?.length ?? 0} grupos`
              : `${groups?.length ?? 0} grupos`}
          </p>
        </>
      )}

      <CreateGroupModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => load(true)}
      />
      <JoinGroupModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={() => load(true)}
      />
      <GroupDetailsModal
        group={selected}
        onClose={() => setSelected(null)}
        onChanged={() => load(true)}
        selfJid={selfJid}
      />
    </div>
  )
}

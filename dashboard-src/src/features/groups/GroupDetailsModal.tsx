import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Check,
  Copy,
  Crown,
  Info,
  Link2,
  LogOut,
  RefreshCw,
  Settings,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  Toggle,
} from '../../components/ui/primitives'
import { ContactPicker, type PickedContact } from './ContactPicker'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import {
  GROUP_NAME_MAX,
  cn,
  copyToClipboard,
  fileToBase64,
  formatDate,
  formatPhone,
  jidToPhone,
} from '../../lib/utils'
import type { GroupInfo, GroupParticipant } from '../../lib/types'

type Section = 'info' | 'participants' | 'settings' | 'invite'

const SECTIONS: { id: Section; label: string; icon: typeof Info }[] = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'participants', label: 'Participantes', icon: Users },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'invite', label: 'Convite', icon: Link2 },
]

const TIMERS = [
  { value: 'off', label: 'Desativado' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
  { value: '90d', label: '90 dias' },
]

function timerValue(seconds?: number): string {
  if (!seconds) return 'off'
  if (seconds <= 86_400) return '24h'
  if (seconds <= 604_800) return '7d'
  return '90d'
}

export function GroupDetailsModal({
  group: initial,
  onClose,
  onChanged,
  selfJid,
}: {
  group: GroupInfo | null
  onClose: () => void
  onChanged: () => void
  selfJid: string
}) {
  const toast = useToast()
  const [section, setSection] = useState<Section>('info')
  const [group, setGroup] = useState<GroupInfo | null>(initial)
  const [busy, setBusy] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<GroupParticipant | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [adding, setAdding] = useState<PickedContact[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [invite, setInvite] = useState('')
  const [copied, setCopied] = useState(false)

  const open = Boolean(initial)

  useEffect(() => {
    setGroup(initial)
    setSection('info')
    setName(initial?.Name ?? '')
    setTopic(initial?.Topic ?? '')
    setAdding([])
    setShowPicker(false)
    setInvite('')
  }, [initial])

  const participants = useMemo(() => {
    const list = group?.Participants ?? []
    // Admins first, then alphabetical — the people who can act come first.
    return [...list].sort((a, b) => {
      const rank = (p: GroupParticipant) => (p.IsSuperAdmin ? 0 : p.IsAdmin ? 1 : 2)
      const delta = rank(a) - rank(b)
      if (delta !== 0) return delta
      return (a.DisplayName || a.JID).localeCompare(b.DisplayName || b.JID, 'pt-BR')
    })
  }, [group])

  const selfPhone = jidToPhone(selfJid)
  const iAmAdmin = useMemo(
    () =>
      participants.some(
        (participant) =>
          jidToPhone(participant.JID) === selfPhone &&
          (participant.IsAdmin || participant.IsSuperAdmin),
      ),
    [participants, selfPhone],
  )

  const reload = useCallback(async () => {
    if (!group?.JID) return
    try {
      setGroup(await api.groupInfo(group.JID))
    } catch {
      // Keep whatever we already have; the list view refresh will catch up.
    }
    onChanged()
  }, [group?.JID, onChanged])

  const run = useCallback(
    async (key: string, task: () => Promise<unknown>, success: string) => {
      setBusy(key)
      try {
        await task()
        toast.success(success)
        await reload()
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setBusy('')
      }
    },
    [reload, toast],
  )

  if (!group) return null

  const jid = group.JID

  /* ------------------------------------------------------------------ info */

  const saveInfo = async () => {
    const trimmedName = name.trim()
    const trimmedTopic = topic.trim()
    const tasks: Promise<unknown>[] = []
    if (trimmedName && trimmedName !== group.Name) tasks.push(api.setGroupName(jid, trimmedName))
    if (trimmedTopic !== (group.Topic ?? '')) tasks.push(api.setGroupTopic(jid, trimmedTopic))

    if (tasks.length === 0) {
      toast.info('Nada foi alterado.')
      return
    }
    await run('info', () => Promise.all(tasks), 'Informações do grupo atualizadas.')
  }

  const changePhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem precisa ter no máximo 5 MB.')
      return
    }

    const dataUrl = await fileToBase64(file)
    await run('photo', () => api.setGroupPhoto(jid, dataUrl), 'Foto do grupo atualizada.')
  }

  /* --------------------------------------------------------------- invite */

  const loadInvite = async (reset = false) => {
    setBusy('invite')
    try {
      const result = await api.inviteLink(jid, reset)
      setInvite(result?.InviteLink ?? '')
      if (reset) toast.success('Link redefinido. O anterior parou de funcionar.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy('')
    }
  }

  const copyInvite = async () => {
    if (await copyToClipboard(invite)) {
      setCopied(true)
      toast.success('Link copiado.')
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Não foi possível copiar o link.')
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={group.Name || 'Grupo'}
        description={`${participants.length} ${participants.length === 1 ? 'participante' : 'participantes'} · criado em ${formatDate(group.GroupCreated)}`}
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto text-down hover:bg-down-soft"
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className="size-4" aria-hidden />
              Sair do grupo
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </>
        }
      >
        <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções do grupo">
          {SECTIONS.map((item) => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id)
                  if (item.id === 'invite' && !invite) loadInvite()
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-accent text-text'
                    : 'border-transparent text-muted hover:text-text',
                )}
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </nav>

        {!iAmAdmin && section !== 'info' && (
          <p className="mb-4 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
            Você não é administrador deste grupo, então algumas ações vão ser recusadas pelo
            WhatsApp.
          </p>
        )}

        {/* -------------------------------------------------------- info -- */}
        {section === 'info' && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                <Users className="size-6 text-faint" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  loading={busy === 'photo'}
                >
                  <Camera className="size-3.5" aria-hidden />
                  Trocar foto
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-down hover:bg-down-soft"
                  onClick={() =>
                    run('photo', () => api.removeGroupPhoto(jid), 'Foto do grupo removida.')
                  }
                >
                  Remover foto
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) changePhoto(file)
                    event.target.value = ''
                  }}
                />
              </div>
            </div>

            <Field label="Nome do grupo" hint={`${name.length}/${GROUP_NAME_MAX} caracteres`}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, GROUP_NAME_MAX))}
                maxLength={GROUP_NAME_MAX}
              />
            </Field>

            <Field label="Descrição">
              <Textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={3}
                placeholder="Sem descrição"
              />
            </Field>

            <dl className="grid gap-2 rounded-lg border border-line bg-surface-2 p-3.5 text-[13px] sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-xs text-faint">JID</dt>
                <dd className="min-w-0 truncate font-mono text-[11px] text-muted">{jid}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-xs text-faint">Criado em</dt>
                <dd className="text-muted">{formatDate(group.GroupCreated)}</dd>
              </div>
            </dl>

            <Button variant="primary" onClick={saveInfo} loading={busy === 'info'}>
              Salvar alterações
            </Button>
          </div>
        )}

        {/* ------------------------------------------------ participants -- */}
        {section === 'participants' && (
          <div className="space-y-4">
            {showPicker ? (
              <div className="rounded-xl border border-line p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-text">Adicionar participantes</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPicker(false)
                      setAdding([])
                    }}
                    aria-label="Cancelar"
                    className="grid size-6 place-items-center rounded text-faint hover:text-text"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <ContactPicker
                  selected={adding}
                  onChange={setAdding}
                  exclude={participants.map((participant) => participant.JID)}
                />

                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={adding.length === 0}
                  loading={busy === 'add'}
                  onClick={async () => {
                    await run(
                      'add',
                      () =>
                        api.updateParticipants(
                          jid,
                          'add',
                          adding.map((contact) => contact.phone),
                        ),
                      `${adding.length} ${adding.length === 1 ? 'participante adicionado' : 'participantes adicionados'}.`,
                    )
                    setAdding([])
                    setShowPicker(false)
                  }}
                >
                  Adicionar {adding.length > 0 && `(${adding.length})`}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowPicker(true)}>
                <UserPlus className="size-3.5" aria-hidden />
                Adicionar participantes
              </Button>
            )}

            <ul className="divide-y divide-line/60 rounded-xl border border-line">
              {participants.map((participant) => {
                const phone = jidToPhone(participant.JID)
                const isSelf = phone === selfPhone
                const key = `p-${phone}`

                return (
                  <li key={participant.JID} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] text-text">
                        {participant.DisplayName || formatPhone(phone)}
                        {isSelf && (
                          <Badge tone="accent" className="shrink-0">
                            você
                          </Badge>
                        )}
                        {participant.IsSuperAdmin ? (
                          <Badge tone="pairing" className="shrink-0">
                            <Crown className="size-2.5" aria-hidden />
                            dono
                          </Badge>
                        ) : (
                          participant.IsAdmin && (
                            <Badge tone="up" className="shrink-0">
                              admin
                            </Badge>
                          )
                        )}
                      </p>
                      {participant.DisplayName && (
                        <p className="tnum truncate text-[11px] text-faint">
                          {formatPhone(phone)}
                        </p>
                      )}
                    </div>

                    {!isSelf && !participant.IsSuperAdmin && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() =>
                            run(
                              key,
                              () =>
                                api.updateParticipants(
                                  jid,
                                  participant.IsAdmin ? 'demote' : 'promote',
                                  [phone],
                                ),
                              participant.IsAdmin
                                ? 'Participante rebaixado.'
                                : 'Participante promovido a admin.',
                            )
                          }
                          title={participant.IsAdmin ? 'Rebaixar' : 'Promover a admin'}
                          aria-label={participant.IsAdmin ? 'Rebaixar' : 'Promover a admin'}
                          className="grid size-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40"
                        >
                          {participant.IsAdmin ? (
                            <ShieldMinus className="size-3.5" aria-hidden />
                          ) : (
                            <ShieldPlus className="size-3.5" aria-hidden />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => setPendingRemove(participant)}
                          title="Remover do grupo"
                          aria-label="Remover do grupo"
                          className="grid size-7 place-items-center rounded-lg text-faint transition-colors hover:bg-down-soft hover:text-down disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* ---------------------------------------------------- settings -- */}
        {section === 'settings' && (
          <div className="space-y-5">
            <Toggle
              checked={Boolean(group.IsAnnounce)}
              disabled={busy === 'announce'}
              onChange={(next) =>
                run(
                  'announce',
                  () => api.setGroupAnnounce(jid, next),
                  next
                    ? 'Só administradores podem enviar mensagens.'
                    : 'Todos podem enviar mensagens.',
                )
              }
              label="Só administradores enviam mensagens"
              hint="Os demais participantes ficam apenas como leitores."
            />

            <Toggle
              checked={Boolean(group.IsLocked)}
              disabled={busy === 'locked'}
              onChange={(next) =>
                run(
                  'locked',
                  () => api.setGroupLocked(jid, next),
                  next
                    ? 'Só administradores podem editar o grupo.'
                    : 'Todos podem editar o grupo.',
                )
              }
              label="Só administradores editam o grupo"
              hint="Vale para nome, descrição e foto."
            />

            <Field
              label="Mensagens temporárias"
              hint="Novas mensagens somem automaticamente depois desse prazo."
            >
              <Select
                value={timerValue(group.DisappearingTimer)}
                disabled={busy === 'timer'}
                onChange={(event) =>
                  run(
                    'timer',
                    () => api.setDisappearing(jid, event.target.value),
                    'Prazo das mensagens temporárias atualizado.',
                  )
                }
              >
                {TIMERS.map((timer) => (
                  <option key={timer.value} value={timer.value}>
                    {timer.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {/* ------------------------------------------------------ invite -- */}
        {section === 'invite' && (
          <div className="space-y-4">
            {busy === 'invite' && !invite ? (
              <div className="flex justify-center py-10">
                <Spinner className="size-5" />
              </div>
            ) : (
              <>
                <Field
                  label="Link de convite"
                  hint="Qualquer pessoa com o link consegue entrar no grupo."
                >
                  <div className="flex gap-1.5">
                    <Input
                      value={invite}
                      readOnly
                      placeholder="Não foi possível gerar o link"
                      className="font-mono text-[12px]"
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      size="icon"
                      onClick={copyInvite}
                      disabled={!invite}
                      title="Copiar link"
                      aria-label="Copiar link"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-up" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                    </Button>
                  </div>
                </Field>

                <div className="rounded-xl border border-pairing/30 bg-pairing-soft p-3.5">
                  <p className="text-[13px] font-medium text-text">Redefinir o link</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Cria um link novo e invalida o atual. Quem tiver o link antigo não consegue
                    mais entrar.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    loading={busy === 'invite'}
                    onClick={() => loadInvite(true)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Redefinir link
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={async () => {
          try {
            await api.leaveGroup(jid)
            toast.success('Você saiu do grupo.')
            setConfirmLeave(false)
            onChanged()
            onClose()
          } catch (error) {
            toast.error(errorMessage(error))
          }
        }}
        title="Sair do grupo"
        description={`Você vai deixar “${group.Name}”. Para voltar, vai precisar de um novo convite.`}
        confirmLabel="Sair do grupo"
        destructive
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        onConfirm={async () => {
          if (!pendingRemove) return
          const phone = jidToPhone(pendingRemove.JID)
          await run(
            `p-${phone}`,
            () => api.updateParticipants(jid, 'remove', [phone]),
            'Participante removido.',
          )
          setPendingRemove(null)
        }}
        title="Remover participante"
        description={
          pendingRemove
            ? `${pendingRemove.DisplayName || formatPhone(jidToPhone(pendingRemove.JID))} será removido do grupo.`
            : ''
        }
        confirmLabel="Remover"
        destructive
      />
    </>
  )
}

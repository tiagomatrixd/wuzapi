import { useState } from 'react'
import { Search, UserRound } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import { formatPhone, jidToPhone, normalizePhoneJid } from '../../lib/utils'
import type { WhatsAppUserInfo } from '../../lib/types'

interface Result {
  jid: string
  info: WhatsAppUserInfo | null
  avatar: string
}

function verifiedName(info: WhatsAppUserInfo | null): string {
  const raw = info?.VerifiedName
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  return raw.Details?.verifiedName ?? ''
}

/**
 * The old dashboard split "user info" and "user avatar" into two modals that
 * each asked for the same number. One lookup answers both questions at once.
 */
export function LookupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPhone('')
    setResult(null)
    onClose()
  }

  const lookup = async () => {
    const jid = normalizePhoneJid(phone)
    if (!jid || jidToPhone(jid).length < 8) {
      toast.error('Informe o número com código do país e DDD.')
      return
    }

    setBusy(true)
    setResult(null)
    try {
      // The avatar is optional: plenty of numbers simply have no public photo.
      const [info, avatar] = await Promise.all([
        api.userInfo(jid).catch(() => null),
        api.avatar(jid).catch(() => null),
      ])

      const entry = info?.Users ? Object.entries(info.Users)[0] : undefined
      if (!entry && !avatar?.url) {
        toast.error('Nenhum dado encontrado para esse número.')
        return
      }

      setResult({
        jid: entry?.[0] ?? jid,
        info: entry?.[1] ?? null,
        avatar: avatar?.url ?? '',
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Consultar número"
      description="Verifica se um número tem WhatsApp e mostra o perfil público."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Fechar
          </Button>
          <Button variant="primary" onClick={lookup} loading={busy}>
            <Search className="size-4" aria-hidden />
            Consultar
          </Button>
        </>
      }
    >
      <Field label="Número" required hint="Com código do país e DDD. Ex.: 5511999998888">
        <Input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') lookup()
          }}
          placeholder="5511999998888"
          inputMode="numeric"
          className="tnum font-mono"
        />
      </Field>

      {result && (
        <div className="animate-in mt-5 rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-center gap-3.5">
            {result.avatar ? (
              <img
                src={result.avatar}
                alt=""
                className="size-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-full border border-line bg-surface">
                <UserRound className="size-6 text-faint" aria-hidden />
              </div>
            )}

            <div className="min-w-0">
              <p className="tnum truncate font-medium text-text">
                {formatPhone(result.jid)}
              </p>
              {verifiedName(result.info) && (
                <p className="truncate text-[13px] text-muted">{verifiedName(result.info)}</p>
              )}
            </div>
          </div>

          <dl className="mt-4 space-y-2 border-t border-line pt-3.5 text-[13px]">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-faint">Recado</dt>
              <dd className="min-w-0 text-muted">{result.info?.Status || '—'}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-faint">Dispositivos</dt>
              <dd className="tnum text-muted">{result.info?.Devices?.length ?? 0}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input, Toggle } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import type { Instance } from '../../lib/types'

export function ProxyModal({
  open,
  onClose,
  onSaved,
  instance,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  instance: Instance
}) {
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setEnabled(instance.proxy_config?.enabled ?? false)
    setUrl(instance.proxy_config?.proxy_url ?? '')
    setError('')
  }, [open, instance])

  const save = async () => {
    const trimmed = url.trim()
    if (enabled) {
      if (!trimmed) {
        setError('Informe a URL do proxy.')
        return
      }
      if (!/^(https?|socks5):\/\//i.test(trimmed)) {
        setError('Use http://, https:// ou socks5://.')
        return
      }
    }

    setBusy(true)
    try {
      await api.setProxy(enabled, enabled ? trimmed : '')
      toast.success(enabled ? 'Proxy ativado.' : 'Proxy desativado.')
      onSaved()
      onClose()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proxy"
      description="Roteia a conexão com o WhatsApp por um servidor intermediário."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label="Usar proxy nesta instância"
          hint="A conexão é reiniciada ao salvar."
        />

        {enabled && (
          <Field label="URL do proxy" required error={error}>
            <Input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError('')
              }}
              placeholder="socks5://usuario:senha@host:1080"
              className="font-mono text-[12px]"
              spellCheck={false}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}

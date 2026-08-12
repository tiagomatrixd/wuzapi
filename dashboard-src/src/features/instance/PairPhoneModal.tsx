import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

/** Pairing by code, for phones that cannot scan a QR from the screen. */
export function PairPhoneModal({
  open,
  onClose,
  token,
}: {
  open: boolean
  onClose: () => void
  token: string
}) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPhone('')
    setCode('')
    onClose()
  }

  const request = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      toast.error('Informe o número com DDI e DDD, por exemplo 5511999998888.')
      return
    }

    setBusy(true)
    try {
      // The session must be up before WhatsApp will hand out a linking code.
      await api.connect(token).catch(() => undefined)
      const result = await api.pairPhone(digits, token)
      if (result?.LinkingCode) {
        setCode(result.LinkingCode)
      } else {
        toast.error('O servidor não devolveu um código de pareamento.')
      }
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
      title="Parear por código"
      description="Alternativa ao QR code, útil quando o celular não consegue ler a tela."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Fechar
          </Button>
          {!code && (
            <Button variant="primary" onClick={request} loading={busy}>
              Gerar código
            </Button>
          )}
        </>
      }
    >
      {code ? (
        <div className="text-center">
          <p className="text-[13px] text-muted">Digite este código no seu WhatsApp:</p>
          <p className="tnum my-4 font-mono text-3xl font-semibold tracking-[0.2em] text-text">
            {code}
          </p>
          <ol className="space-y-1 text-left text-[13px] leading-relaxed text-muted">
            <li>1. Abra o WhatsApp no celular</li>
            <li>2. Toque em Dispositivos conectados</li>
            <li>3. Toque em Conectar um dispositivo</li>
            <li>4. Toque em Conectar com número de telefone e digite o código</li>
          </ol>
        </div>
      ) : (
        <Field
          label="Número do WhatsApp"
          required
          hint="Somente dígitos, com código do país e DDD. Ex.: 5511999998888"
        >
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') request()
            }}
            placeholder="5511999998888"
            inputMode="numeric"
            className="tnum font-mono"
          />
        </Field>
      )}
    </Modal>
  )
}

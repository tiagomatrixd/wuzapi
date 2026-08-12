/**
 * Webhook event catalogue, grouped the way an operator thinks about them rather
 * than the flat 50-item list the old dashboard rendered as one <select multiple>.
 * Values must match the whatsmeow event names the server subscribes to.
 */
export interface EventGroup {
  label: string
  events: { value: string; label: string }[]
}

export const EVENT_GROUPS: EventGroup[] = [
  {
    label: 'Mensagens',
    events: [
      { value: 'Message', label: 'Mensagem recebida' },
      { value: 'UndecryptableMessage', label: 'Mensagem não descriptografada' },
      { value: 'Receipt', label: 'Confirmação de entrega/leitura' },
      { value: 'MediaRetry', label: 'Nova tentativa de mídia' },
      { value: 'FBMessage', label: 'Mensagem Facebook/Meta' },
    ],
  },
  {
    label: 'Conexão e sessão',
    events: [
      { value: 'Connected', label: 'Conectado' },
      { value: 'Disconnected', label: 'Desconectado' },
      { value: 'ConnectFailure', label: 'Falha ao conectar' },
      { value: 'LoggedOut', label: 'Sessão encerrada' },
      { value: 'KeepAliveRestored', label: 'Keep-alive restaurado' },
      { value: 'KeepAliveTimeout', label: 'Keep-alive expirado' },
      { value: 'ClientOutdated', label: 'Cliente desatualizado' },
      { value: 'TemporaryBan', label: 'Banimento temporário' },
      { value: 'StreamError', label: 'Erro de stream' },
      { value: 'StreamReplaced', label: 'Stream substituído' },
      { value: 'QR', label: 'QR code gerado' },
      { value: 'QRScannedWithoutMultidevice', label: 'QR lido sem multidispositivo' },
      { value: 'PairSuccess', label: 'Pareamento concluído' },
      { value: 'PairError', label: 'Erro no pareamento' },
      { value: 'CATRefreshError', label: 'Erro ao renovar CAT' },
    ],
  },
  {
    label: 'Grupos e contatos',
    events: [
      { value: 'GroupInfo', label: 'Alteração em grupo' },
      { value: 'JoinedGroup', label: 'Entrou em grupo' },
      { value: 'Picture', label: 'Foto alterada' },
      { value: 'Blocklist', label: 'Lista de bloqueio' },
      { value: 'BlocklistChange', label: 'Alteração na lista de bloqueio' },
      { value: 'IdentityChange', label: 'Mudança de identidade' },
    ],
  },
  {
    label: 'Presença e chamadas',
    events: [
      { value: 'Presence', label: 'Presença do contato' },
      { value: 'ChatPresence', label: 'Digitando/gravando' },
      { value: 'CallOffer', label: 'Chamada recebida' },
      { value: 'CallAccept', label: 'Chamada aceita' },
      { value: 'CallTerminate', label: 'Chamada encerrada' },
      { value: 'CallOfferNotice', label: 'Aviso de chamada' },
      { value: 'CallRelayLatency', label: 'Latência da chamada' },
    ],
  },
  {
    label: 'Sincronização',
    events: [
      { value: 'AppState', label: 'Estado do app' },
      { value: 'AppStateSyncComplete', label: 'Sincronização concluída' },
      { value: 'HistorySync', label: 'Sincronização de histórico' },
      { value: 'OfflineSyncCompleted', label: 'Sincronização offline concluída' },
      { value: 'OfflineSyncPreview', label: 'Prévia da sincronização offline' },
    ],
  },
  {
    label: 'Configurações e canais',
    events: [
      { value: 'PrivacySettings', label: 'Privacidade' },
      { value: 'PushNameSetting', label: 'Nome de exibição' },
      { value: 'UserAbout', label: 'Recado do contato' },
      { value: 'NewsletterJoin', label: 'Entrou em canal' },
      { value: 'NewsletterLeave', label: 'Saiu de canal' },
      { value: 'NewsletterMuteChange', label: 'Canal silenciado' },
      { value: 'NewsletterLiveUpdate', label: 'Atualização ao vivo de canal' },
    ],
  },
]

export const ALL_EVENTS = EVENT_GROUPS.flatMap((group) => group.events)

export const EVENT_LABEL = new Map(ALL_EVENTS.map((event) => [event.value, event.label]))

/** Parses the comma-separated string the API stores on the users row. */
export function parseEvents(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

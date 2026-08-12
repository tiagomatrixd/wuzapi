import type {
  Contact,
  Envelope,
  GroupInfo,
  Instance,
  S3Config,
  WhatsAppUserInfo,
} from './types'

const BASE = import.meta.env.DEV ? '' : window.location.origin

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Credentials live here rather than being threaded through every call site.
 * `token` authenticates a single instance; `adminToken` authenticates /admin/*.
 * An admin browsing an instance holds both at once.
 */
const credentials = { token: '', adminToken: '' }

export function setCredentials(next: Partial<typeof credentials>): void {
  Object.assign(credentials, next)
}

export function getCredentials(): Readonly<typeof credentials> {
  return credentials
}

type Auth = 'token' | 'admin'

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: Auth
  /** Overrides the stored credential, used when acting on another instance. */
  as?: string
  query?: Record<string, string | number | boolean | undefined>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = 'token', as, query } = options

  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (auth === 'admin') {
    headers.set('authorization', as ?? credentials.adminToken)
  } else {
    headers.set('token', as ?? credentials.token)
  }

  let url = BASE + path
  if (query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Servidor fora do ar. Verifique se o wuzapi está rodando.', 0)
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Token inválido ou expirado.', response.status)
  }

  let envelope: Envelope<T>
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError(`Resposta inválida do servidor (HTTP ${response.status}).`, response.status)
  }

  // Some handlers report failures with a plain string payload, which leaves
  // success=true on an HTTP 5xx. Trust the status code in that case.
  if (!envelope.success || !response.ok) {
    throw new ApiError(
      envelope.error ?? `A requisição falhou (HTTP ${response.status}).`,
      response.status,
    )
  }

  return envelope.data as T
}

export interface CreateInstancePayload {
  name: string
  token: string
  events: string
  webhook: string
  expiration: number
  proxyConfig: { enabled: boolean; proxyURL: string }
  s3Config: {
    enabled: boolean
    endpoint: string
    region: string
    bucket: string
    accessKey: string
    secretKey: string
    pathStyle: boolean
    publicURL: string
    mediaDelivery: string
    retentionDays: number
  }
}

export const api = {
  /* ---------------------------------------------------------------- admin */

  listInstances: () => request<Instance[]>('/admin/users', { auth: 'admin' }),

  createInstance: (payload: CreateInstancePayload) =>
    request<{ id: string }>('/admin/users', { method: 'POST', body: payload, auth: 'admin' }),

  /** `/full` also wipes the whatsmeow device rows, not just the users row. */
  deleteInstance: (id: string) =>
    request<unknown>(`/admin/users/${id}/full`, { method: 'DELETE', auth: 'admin' }),

  /* -------------------------------------------------------------- session */

  status: (as?: string) => request<Instance>('/session/status', { as }),

  connect: (as?: string) =>
    request<unknown>('/session/connect', {
      method: 'POST',
      body: { Subscribe: ['All'], Immediate: true },
      as,
    }),

  disconnect: (as?: string) => request<unknown>('/session/disconnect', { method: 'POST', as }),

  logout: (as?: string) => request<unknown>('/session/logout', { method: 'POST', as }),

  qr: (as?: string) => request<{ QRCode: string }>('/session/qr', { as }),

  pairPhone: (phone: string, as?: string) =>
    request<{ LinkingCode: string }>('/session/pairphone', {
      method: 'POST',
      body: { Phone: phone },
      as,
    }),

  /* -------------------------------------------------------------- webhook */

  getWebhook: () => request<{ webhook: string; subscribe: string[] }>('/webhook'),

  setWebhook: (webhookurl: string, events: string[]) =>
    request<unknown>('/webhook', { method: 'POST', body: { webhookurl, events } }),

  /* ---------------------------------------------------------------- proxy */

  setProxy: (enable: boolean, proxy_url: string) =>
    request<unknown>('/session/proxy', { method: 'POST', body: { enable, proxy_url } }),

  /* ------------------------------------------------------------------- s3 */

  getS3Config: () => request<S3Config>('/session/s3/config'),

  setS3Config: (config: Partial<S3Config> & { secret_key?: string }) =>
    request<unknown>('/session/s3/config', { method: 'POST', body: config }),

  deleteS3Config: () => request<unknown>('/session/s3/config', { method: 'DELETE' }),

  testS3: () => request<unknown>('/session/s3/test', { method: 'POST' }),

  /* ----------------------------------------------------------------- chat */

  sendText: (Phone: string, Body: string, Id: string) =>
    request<{ Id: string }>('/chat/send/text', { method: 'POST', body: { Phone, Body, Id } }),

  deleteMessage: (Phone: string, Id: string) =>
    request<unknown>('/chat/delete', { method: 'POST', body: { Phone, Id } }),

  /* ----------------------------------------------------------------- user */

  userInfo: (phone: string) =>
    request<{ Users: Record<string, WhatsAppUserInfo> }>('/user/info', {
      method: 'POST',
      body: { Phone: [phone] },
    }),

  avatar: (phone: string) =>
    request<{ url: string }>('/user/avatar', {
      method: 'POST',
      body: { Phone: phone, Preview: false },
    }),

  contacts: () => request<Record<string, Contact>>('/user/contacts'),

  /* --------------------------------------------------------------- groups */

  listGroups: () => request<{ Groups: GroupInfo[] | null }>('/group/list'),

  groupInfo: (groupJID: string) => request<GroupInfo>('/group/info', { query: { groupJID } }),

  createGroup: (name: string, participants: string[]) =>
    request<GroupInfo>('/group/create', {
      method: 'POST',
      body: { name, participants },
    }),

  inviteInfo: (code: string) =>
    request<GroupInfo>('/group/inviteinfo', { method: 'POST', body: { code } }),

  joinGroup: (code: string) =>
    request<unknown>('/group/join', { method: 'POST', body: { code } }),

  leaveGroup: (GroupJID: string) =>
    request<unknown>('/group/leave', { method: 'POST', body: { GroupJID } }),

  setGroupName: (GroupJID: string, Name: string) =>
    request<unknown>('/group/name', { method: 'POST', body: { GroupJID, Name } }),

  setGroupTopic: (GroupJID: string, Topic: string) =>
    request<unknown>('/group/topic', { method: 'POST', body: { GroupJID, Topic } }),

  setGroupAnnounce: (GroupJID: string, Announce: boolean) =>
    request<unknown>('/group/announce', { method: 'POST', body: { GroupJID, Announce } }),

  setGroupLocked: (GroupJID: string, Locked: boolean) =>
    request<unknown>('/group/locked', { method: 'POST', body: { GroupJID, Locked } }),

  setDisappearing: (GroupJID: string, Duration: string) =>
    request<unknown>('/group/ephemeral', { method: 'POST', body: { GroupJID, Duration } }),

  updateParticipants: (GroupJID: string, Action: string, Phone: string[]) =>
    request<unknown>('/group/updateparticipants', {
      method: 'POST',
      body: { GroupJID, Action, Phone },
    }),

  inviteLink: (groupJID: string, reset = false) =>
    request<{ InviteLink: string }>('/group/invitelink', {
      query: { groupJID, reset: reset ? 'true' : undefined },
    }),

  setGroupPhoto: (GroupJID: string, Image: string) =>
    request<{ PictureID?: string }>('/group/photo', { method: 'POST', body: { GroupJID, Image } }),

  removeGroupPhoto: (GroupJID: string) =>
    request<unknown>('/group/photo/remove', { method: 'POST', body: { GroupJID } }),
}

/** Turns any thrown value into something safe to show in a toast. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Erro inesperado.'
}

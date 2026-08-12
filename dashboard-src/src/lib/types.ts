/** Every wuzapi handler answers through server.Respond, which wraps the payload. */
export interface Envelope<T> {
  code: number
  success: boolean
  data?: T
  error?: string
}

export interface ProxyConfig {
  enabled: boolean
  proxy_url: string
}

export interface S3Config {
  enabled: boolean
  endpoint: string
  region: string
  bucket: string
  access_key: string
  path_style: boolean
  public_url: string
  media_delivery: 'base64' | 's3' | 'both'
  retention_days: number
}

/** A row of GET /admin/users, and also the body of GET /session/status. */
export interface Instance {
  id: string
  name: string
  token: string
  webhook: string
  jid: string
  qrcode: string
  connected: boolean
  loggedIn: boolean
  expiration?: number
  proxy_url: string
  events: string
  proxy_config: ProxyConfig
  s3_config?: S3Config
}

/**
 * The API exposes two independent booleans. Operators think in one axis, so we
 * collapse them into the three states that actually matter on a status board.
 */
export type SessionState = 'online' | 'pairing' | 'offline'

export interface GroupParticipant {
  JID: string
  LID?: string
  PhoneNumber?: string
  DisplayName?: string
  IsAdmin: boolean
  IsSuperAdmin: boolean
  Error?: number
  AddRequest?: unknown
}

export interface GroupInfo {
  JID: string
  OwnerJID?: string
  Name: string
  NameSetAt?: string
  NameSetBy?: string
  Topic?: string
  TopicID?: string
  TopicSetAt?: string
  TopicSetBy?: string
  TopicDeleted?: boolean
  IsLocked?: boolean
  IsAnnounce?: boolean
  IsEphemeral?: boolean
  DisappearingTimer?: number
  IsIncognito?: boolean
  IsParent?: boolean
  IsDefaultSubGroup?: boolean
  IsJoinApprovalRequired?: boolean
  LinkedParentJID?: string
  GroupCreated?: string
  ParticipantVersionID?: string
  Participants?: GroupParticipant[]
  MemberAddMode?: string
}

/** Communities are parents; their announcement channels link back to a parent. */
export type GroupKind = 'group' | 'community' | 'community_group'

export interface Contact {
  FullName: string
  PushName: string
  BusinessName?: string
  FirstName?: string
  Found?: boolean
}

export interface WhatsAppUserInfo {
  Status?: string
  VerifiedName?: string | { Details?: { verifiedName?: string } }
  PictureID?: string
  Devices?: string[]
}

export type Role = 'admin' | 'user'

export type Theme = 'light' | 'dark' | 'system'

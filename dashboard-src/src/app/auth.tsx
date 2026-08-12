import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setCredentials } from '../lib/api'
import { getStored, removeStored, setStored } from '../lib/storage'
import type { Instance, Role } from '../lib/types'

interface Session {
  role: Role | null
  adminToken: string
  token: string
  /** Set when an admin drills into one instance, or always for a user login. */
  instanceId: string
  instanceName: string
}

interface AuthApi extends Session {
  loginAsAdmin: (token: string) => Promise<void>
  loginAsUser: (token: string) => Promise<void>
  openInstance: (instance: Pick<Instance, 'id' | 'name' | 'token'>) => void
  closeInstance: () => void
  logout: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

function restore(): Session {
  const adminToken = getStored<string>('adminToken') ?? ''
  const token = getStored<string>('token') ?? ''
  const role = getStored<Role>('role')

  const session: Session = {
    role: role && (adminToken || token) ? role : null,
    adminToken,
    token,
    instanceId: getStored<string>('instanceId') ?? '',
    instanceName: getStored<string>('instanceName') ?? '',
  }
  setCredentials({ token: session.token, adminToken: session.adminToken })
  return session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(restore)

  const loginAsAdmin = useCallback(async (adminToken: string) => {
    setCredentials({ adminToken })
    // listInstances is the cheapest call that actually proves the token works.
    await api.listInstances()

    setStored('adminToken', adminToken)
    setStored('role', 'admin')
    setSession({ role: 'admin', adminToken, token: '', instanceId: '', instanceName: '' })
  }, [])

  const loginAsUser = useCallback(async (token: string) => {
    setCredentials({ token })
    const instance = await api.status()

    setStored('token', token)
    setStored('role', 'user')
    setStored('instanceId', instance.id)
    setStored('instanceName', instance.name)
    setSession({
      role: 'user',
      adminToken: '',
      token,
      instanceId: instance.id,
      instanceName: instance.name,
    })
  }, [])

  const openInstance = useCallback((instance: Pick<Instance, 'id' | 'name' | 'token'>) => {
    setCredentials({ token: instance.token })
    setStored('token', instance.token)
    setStored('instanceId', instance.id)
    setStored('instanceName', instance.name)
    setSession((current) => ({
      ...current,
      token: instance.token,
      instanceId: instance.id,
      instanceName: instance.name,
    }))
  }, [])

  const closeInstance = useCallback(() => {
    setCredentials({ token: '' })
    removeStored('token')
    removeStored('instanceId')
    removeStored('instanceName')
    setSession((current) => ({ ...current, token: '', instanceId: '', instanceName: '' }))
  }, [])

  const logout = useCallback(() => {
    setCredentials({ token: '', adminToken: '' })
    for (const key of ['token', 'adminToken', 'role', 'instanceId', 'instanceName']) {
      removeStored(key)
    }
    setSession({ role: null, adminToken: '', token: '', instanceId: '', instanceName: '' })
    window.location.hash = ''
  }, [])

  const value = useMemo<AuthApi>(
    () => ({ ...session, loginAsAdmin, loginAsUser, openInstance, closeInstance, logout }),
    [session, loginAsAdmin, loginAsUser, openInstance, closeInstance, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return context
}

import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, Users } from 'lucide-react'
import { AuthProvider, useAuth } from './app/auth'
import { ToastProvider } from './components/ui/Toast'
import { Shell, type Tab } from './components/Shell'
import { Login } from './views/Login'
import { Sessions } from './views/Sessions'
import { Instance } from './views/Instance'
import { Groups } from './views/Groups'
import { useHashRoute } from './hooks/useHashRoute'
import { api } from './lib/api'
import type { Instance as InstanceType } from './lib/types'

const INSTANCE_TABS: Tab[] = [
  { id: '/instance', label: 'Visão geral', icon: LayoutDashboard },
  { id: '/groups', label: 'Grupos', icon: Users },
]

function Router() {
  const { role, token, instanceId, instanceName, openInstance, closeInstance } = useAuth()
  const { route, navigate } = useHashRoute()
  const [selfJid, setSelfJid] = useState('')

  const insideInstance = Boolean(token && instanceId)

  // Groups need the session's own JID to work out whether we are an admin.
  useEffect(() => {
    if (!insideInstance) {
      setSelfJid('')
      return
    }
    let cancelled = false
    api
      .status(token)
      .then((instance) => {
        if (!cancelled) setSelfJid(instance.jid ?? '')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [insideInstance, token])

  /*
   * Derived synchronously rather than corrected by an effect: a user-token
   * login has no session list, and letting <Sessions> render for even one frame
   * would fire an /admin/users call with no admin token and flash a 401.
   */
  const showInstance =
    insideInstance &&
    (role === 'user' || route.startsWith('/instance') || route.startsWith('/groups'))

  // Keep the URL honest once the correct view is already on screen.
  useEffect(() => {
    if (!role) return
    if (showInstance && !route.startsWith('/instance') && !route.startsWith('/groups')) {
      navigate('/instance', { replace: true })
    } else if (!showInstance && route !== '/sessions') {
      navigate('/sessions', { replace: true })
    }
  }, [role, showInstance, route, navigate])

  const handleOpen = useCallback(
    (instance: InstanceType) => {
      openInstance(instance)
      navigate('/instance')
    },
    [openInstance, navigate],
  )

  const handleBack = useCallback(() => {
    closeInstance()
    navigate('/sessions')
  }, [closeInstance, navigate])

  if (!role) return <Login />

  if (showInstance) {
    const activeTab = route.startsWith('/groups') ? '/groups' : '/instance'

    return (
      <Shell
        tabs={INSTANCE_TABS}
        activeTab={activeTab}
        onTab={navigate}
        // A user-token login has no session list to go back to.
        onBack={role === 'admin' ? handleBack : undefined}
        contextLabel={instanceName}
      >
        {activeTab === '/groups' ? (
          <Groups selfJid={selfJid} />
        ) : (
          <Instance token={token} />
        )}
      </Shell>
    )
  }

  return (
    <Shell>
      <Sessions onOpenInstance={handleOpen} />
    </Shell>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ToastProvider>
  )
}

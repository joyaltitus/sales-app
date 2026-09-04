import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { ClientProvider } from './shell/ClientProvider'
import { ToastProvider } from './ui/Toast'
import { LoginPage, PasswordRecoveryScreen } from './auth/LoginPage'
import { RoleRouter } from './shell/RoleRouter'
import { useTheme } from './shell/theme'
import { Skeleton } from './ui/Skeleton'

// /preview is the only public design route. It stays lazy so review-only
// fixtures never weigh on the authenticated app's first load.
const PreviewGallery = lazy(() => import('./views/preview/PreviewGallery'))

// Public design routes bypass the auth gate so they render for review + PWA
// screenshots without a session. Everything else is auth-gated + role-routed.
export function App() {
  useTheme() // applies data-theme on <html> app-wide
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-24 w-full" /></div>}>
      <Routes>
        <Route path="/preview" element={<PreviewGallery />} />
        <Route path="/*" element={<AuthedApp />} />
      </Routes>
    </Suspense>
  )
}

function AuthedApp() {
  return (
    <AuthProvider>
      <ClientProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </ClientProvider>
    </AuthProvider>
  )
}

function Gate() {
  const { session, loading, passwordRecovery } = useAuth()
  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  // Checked before `session`: a recovery-link click already gives Supabase a
  // valid session, so without this a rep landing here would fall straight
  // through into the app instead of the "choose a new password" screen.
  if (passwordRecovery) return <PasswordRecoveryScreen />
  if (!session) return <LoginPage />
  return <RoleRouter />
}

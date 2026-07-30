import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { ClientProvider } from './shell/ClientProvider'
import { ToastProvider } from './ui/Toast'
import { LoginPage } from './auth/LoginPage'
import { RoleRouter } from './shell/RoleRouter'
import { useTheme } from './shell/theme'
import { Skeleton } from './ui/Skeleton'

// Design routes are dev/review surfaces (and pull the Geist font candidate) —
// lazy so they never weigh on first-load JS or the offline precache.
const KitchenSink = lazy(() =>
  import('./ui/KitchenSink').then((m) => ({ default: m.KitchenSink })),
)
const SampleBoard = lazy(() =>
  import('./ui/SampleBoard').then((m) => ({ default: m.SampleBoard })),
)
// SA-04: mock-data-only review surface (Dashboard + CRM sample tabs). Same
// public-design-route convention; it can render nothing tenant-scoped.
const DesignPreview = lazy(() =>
  import('./views/design/DesignPreview').then((m) => ({ default: m.DesignPreview })),
)

// Public design routes bypass the auth gate so they render for review + PWA
// screenshots without a session. Everything else is auth-gated + role-routed.
export function App() {
  useTheme() // applies data-theme on <html> app-wide
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-24 w-full" /></div>}>
      <Routes>
        <Route path="/kitchen-sink" element={<KitchenSink />} />
        <Route path="/samples" element={<SampleBoard />} />
        <Route path="/preview" element={<DesignPreview />} />
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
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (!session) return <LoginPage />
  return <RoleRouter />
}

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Copy-once from Workbench, then owned.
type AuthState = {
  session: Session | null
  loading: boolean
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  passwordRecovery: false,
  clearPasswordRecovery: () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Set by the PASSWORD_RECOVERY auth event when a rep lands here from the
  // reset-link email — Supabase already gives them a valid session at that
  // point, so this flag is what stops Gate from treating it as a normal
  // sign-in and routing straight into the app.
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  return (
    <AuthContext.Provider value={{ session, loading, passwordRecovery, clearPasswordRecovery, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

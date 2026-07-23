import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Feature-flag reader (§C: a disabled flag hides its door). Reads
// clients.feature_flags jsonb via anon-key+RLS. No flag = door hidden.
export type FeatureFlags = Record<string, boolean>

export function useFlags(clientId: string | null) {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setFlags({})
      setLoading(false)
      return
    }
    let live = true
    supabase
      .from('clients')
      .select('feature_flags')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return
        setFlags((data?.feature_flags as FeatureFlags) ?? {})
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [clientId])

  return { flags, loading }
}

// A door is open only when its flag is explicitly true.
export function flagOn(flags: FeatureFlags, key: string): boolean {
  return flags[key] === true
}

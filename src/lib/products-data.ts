import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Products / courses layer. `items` is the client's catalogue — the same table
// bookings price against — so a lead's product means the same thing here as it
// does everywhere else in the system.
//
// Reps can READ this (items_select: any member of the client) but cannot write
// it (items_write: client_admin only). So "add your own product" in a lead form
// is a free-text value carried on that lead, NOT a new catalogue row — offering
// a rep a Create button here would be offering them a guaranteed RLS denial.
const PRODUCT_LIMIT = 200

export type Product = {
  id: string
  name: string
  price: number
  category: string | null
}

export function useProducts(clientId: string | null) {
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: readError } = await supabase
      .from('items')
      .select('id, name, price, category')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(PRODUCT_LIMIT)
    setError(readError?.message ?? null)
    setItems((data ?? []) as Product[])
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  return { items, loading, error, reload: load }
}

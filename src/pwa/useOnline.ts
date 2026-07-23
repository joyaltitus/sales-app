import { useEffect, useState } from 'react'

// Connection state for the reconnect chip. The cached shell (workbox precache)
// paints offline; this drives the quiet "Reconnecting…" chip so the app never
// looks dead on a dropped connection (§C offline tolerance).
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

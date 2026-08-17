import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--warn)_40%,var(--border))] bg-surface-glass px-3.5 py-1.5 text-xs font-semibold text-warn shadow-elev-3 backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
    >
      <WifiOff aria-hidden size={14} className="animate-pulse text-warn" />
      <span>You are offline. Reconnecting…</span>
    </div>
  )
}

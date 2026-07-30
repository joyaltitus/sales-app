import { useState } from 'react'

// SA-05 avatar — Joyal's direct ask ("need to see the profile pic") supersedes
// §1.10 #4 for contact identity everywhere it appears. A real profile picture
// renders when the channel gave us one (contacts.profile JSON); the fallback is
// an INITIAL IN A ROUNDED SQUARE on the neutral scale — deliberately not the
// tinted initial-circle §1.10 #4 was aimed at. No per-name hash hues: the
// palette is frozen and identity comes from the name beside it, not a colour.

/** Best-effort profile-picture URL from the contacts.profile JSON blob. Keys
 *  differ per channel/ingestion era; absent or broken → initials. */
export function profilePicUrl(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null
  const p = profile as Record<string, unknown>
  const candidate =
    p.profile_pic_url ?? p.profile_picture_url ?? p.avatar_url ?? p.picture ?? p.profile_pic
  return typeof candidate === 'string' && candidate.startsWith('http') ? candidate : null
}

const SIZE = {
  sm: 'h-6 w-6 text-2xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
} as const

export function Avatar({
  name,
  profile,
  size = 'md',
}: {
  name: string | null
  profile?: unknown
  size?: keyof typeof SIZE
}) {
  const [broken, setBroken] = useState(false)
  const url = profilePicUrl(profile)
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        onError={() => setBroken(true)}
        className={[SIZE[size], 'shrink-0 rounded-md border border-border object-cover'].join(' ')}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={[
        SIZE[size],
        'flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunk font-semibold text-fg-muted select-none',
      ].join(' ')}
    >
      {initial}
    </span>
  )
}

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

/** First letter of the first word that has one. Phone-number names (+91…)
 *  and emoji names get a neutral mark instead of '+', '1' or a broken half of
 *  a surrogate pair. */
export function avatarInitial(name: string | null): string {
  const letters = (name ?? '').match(/\p{L}/u)
  return letters ? letters[0].toUpperCase() : '·'
}

const SIZE = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
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
  const initial = avatarInitial(name)

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        onError={() => setBroken(true)}
        className={[SIZE[size], 'shrink-0 rounded-[10px] border border-border-strong object-cover shadow-elev-1'].join(' ')}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={[
        SIZE[size],
        'flex shrink-0 items-center justify-center rounded-[10px] border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--surface-sunk))] font-semibold text-fg-muted shadow-elev-1 select-none',
      ].join(' ')}
    >
      {initial}
    </span>
  )
}

import { MessageCircle } from 'lucide-react'

// Small channel marker — Joyal's ask: "small icon where it's insta or
// WhatsApp". lucide dropped brand glyphs upstream, so Instagram is drawn here
// from primitives (rounded square + lens + dot — unmistakable in outline) and
// WhatsApp uses the chat bubble. Monochrome on the neutral scale: brand
// gradients/colours are outside the frozen palette and stay out.
function InstagramGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ChannelIcon({ channel, size = 14 }: { channel: string | null; size?: number }) {
  const ig = channel === 'instagram'
  return (
    <span
      className="inline-flex shrink-0 items-center text-fg-subtle"
      role="img"
      aria-label={ig ? 'Instagram' : 'WhatsApp'}
      title={ig ? 'Instagram' : 'WhatsApp'}
    >
      {ig ? (
        <InstagramGlyph size={size} />
      ) : (
        <MessageCircle aria-hidden size={size} strokeWidth={1.75} />
      )}
    </span>
  )
}

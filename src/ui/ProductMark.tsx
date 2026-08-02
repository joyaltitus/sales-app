export function ProductMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-border-strong bg-surface-raised shadow-elev-1"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-x-[18%] top-[30%] h-px bg-border-strong" />
      <span className="absolute inset-x-[18%] top-1/2 h-px bg-border-strong" />
      <span className="absolute inset-x-[18%] top-[70%] h-px bg-border-strong" />
      <span className="absolute left-[18%] top-1/2 h-px w-[42%] bg-accent" />
      <span className="absolute right-[18%] top-[70%] h-1.5 w-1.5 -translate-y-1/2 rounded-pill bg-signal shadow-[0_0_10px_var(--signal)]" />
    </span>
  )
}

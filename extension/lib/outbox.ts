/**
 * Outbox — the durable queue of rep actions waiting to reach Supabase.
 *
 * Pure list algebra: the wiring session owns persistence; this module owns
 * the rules. The outbox NEVER drops entries to make room — a full outbox
 * refuses the new entry and says so.
 */
import type { OutboxEntry } from './contracts'

/** Hard cap: 200 pending actions is far past anything a rep day produces. */
export const OUTBOX_LIMIT = 200

export type OutboxFullError = 'OUTBOX_FULL'

export type EnqueueResult =
  | { ok: true; list: OutboxEntry[] }
  | { ok: false; error: OutboxFullError; list: OutboxEntry[] }

/** Append `entry`. Refuses entry 201 by returning a named error, keeping the original list intact. */
export function enqueue(list: readonly OutboxEntry[], entry: OutboxEntry): EnqueueResult {
  if (list.length >= OUTBOX_LIMIT) {
    return { ok: false, error: 'OUTBOX_FULL', list: [...list] }
  }
  return { ok: true, list: [...list, entry] }
}

/** The sender the wiring session provides. Throw to fail the entry. */
export type OutboxRun = (entry: OutboxEntry) => Promise<unknown> | unknown

export type DrainResult = {
  /** Entries still to send — the failed one first (with attempts/last_error updated), original order preserved. */
  remaining: OutboxEntry[]
  /** How many entries were sent successfully before stopping. */
  done: number
  /** The entry that failed, or null when everything drained. */
  failed: OutboxEntry | null
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Run oldest-first, stop at the FIRST failure. Successful entries leave the
 * list; only the failed entry gets its `attempts` incremented and `last_error`
 * set. Everything later keeps its original order and is untouched.
 */
export async function drain(list: readonly OutboxEntry[], run: OutboxRun): Promise<DrainResult> {
  const remaining = [...list]
  let done = 0
  while (remaining.length > 0) {
    const next = remaining[0]
    try {
      await run(next)
      remaining.shift()
      done += 1
    } catch (err) {
      const failed: OutboxEntry = {
        ...next,
        attempts: next.attempts + 1,
        last_error: errorText(err),
      }
      remaining[0] = failed
      return { remaining, done, failed }
    }
  }
  return { remaining, done, failed: null }
}

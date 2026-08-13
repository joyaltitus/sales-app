#!/usr/bin/env python3
"""PreToolUse serialization guard (DEVSYS-07, dead-holder reap DEVSYS-11).

Makes three dev-system laws mechanical instead of honor-system: one /migration, one
deploy-to-main, one battery run at a time, ACROSS parallel worktree sessions. The lock
home is OUTSIDE every worktree (each worktree carries its own .claude/), so two sessions
genuinely contend for one directory. An atomic os.rename of a fully-staged directory is the
acquire (RBLD-02, was os.mkdir + a separate holder write): first matching call acquires and
records a holder in the same instant, another session's matching call is BLOCKED (exit 2),
the holder itself is re-entrant. Release is explicit: `--release` (run by /close-lite)
drops every lock whose holder root is this worktree; `--release-stale <name>` (DEVSYS-12)
drops ONE named lock that is already past the stale window, from any cwd, and is what a
STALE block message now tells you to run; `--list` prints the table, read-only. All three
are self-exempt by construction — matched_locks() triggers on npm/git-push/apply_migration,
never on `python3`, so the guard can never block its own recovery command (#143).
Fails CLOSED — a bare exception exits 1, which Claude Code treats as NON-blocking, so
main() is wrapped and any error exits 2.

NEVER-AUTO-BREAK, and the one principled exception (DEVSYS-11). A lock older than
STALE_SECONDS still BLOCKS; its message just carries the rm command. The single case
that is reaped automatically is a holder whose ROOT DIRECTORY NO LONGER EXISTS: no
session can be running inside a directory that is not there, so "not held" is a liveness
FACT rather than a timeout guess. Everything about that reap is deliberately narrow —
it happens only at acquire time (when a session is actually blocked), never as a
background sweep and never from `--list`, and it writes an audit line naming the dead
holder. A lock whose holder directory still exists is never touched, however old.
The failure this fixes was real and immediate: a session pushed, removed its worktree,
and never released; the orphaned lock then blocked every other session for the full 2h
window with no recovery but a human `rm -rf`.
"""
import datetime, errno, glob, hashlib, json, os, re, shlex, shutil, sys, tempfile

import guard_core

LOCK_HOME = os.environ.get("LOCK_HOME") or os.path.expanduser(
    "~/.claude/projects/-Users-joyaltitus-Documents-hub-service/locks")
STALE_SECONDS = 2 * 3600
BATTERY_SCRIPTS = {"test:integration", "shadow"}
PUSH_MAIN_RE = re.compile(r"^(?:[^:\s]*:)?(?:refs/heads/)?main$")
UTC = datetime.timezone.utc


def repo_root(start):
    """Worktree-aware root: nearest ancestor carrying the guard config (protect.py's walk)."""
    d = start or os.getcwd()
    while d and d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, ".claude", "protected-paths.json")):
            return d
        d = os.path.dirname(d)
    return start or os.getcwd()


def guard_log(root, rule, detail):
    """Append to the same ledger protect.py writes. A reap must never be silent."""
    try:
        p = os.path.join(root, ".claude", "tmp", "guard-log")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "a") as f:
            f.write(f"{datetime.datetime.now(UTC).isoformat(timespec='seconds')}\t"
                    f"lock_guard\t{rule}\t{detail}\n")
    except OSError:
        pass  # the ledger is a counter, never a second gate


def session_lock_name(root):
    """One ownership namespace per worktree, shared by every harness in it."""
    digest = hashlib.sha256(os.path.realpath(root).encode()).hexdigest()[:16]
    return f"session-{digest}"


def matched_locks(tool, tin, root):
    """Locks this call needs. High-precision by design: a protected command's TEXT
    inside a commit message must never acquire a lock (protect.py's DEVSYS-04 lesson), so
    matching is token-resolved per subcommand, never a substring scan."""
    locks = [session_lock_name(root)] if guard_core.starts_build(tool, tin) else []
    if tool == "mcp__supabase__apply_migration":
        return locks + ["migration"]
    if tool != "Bash":
        return locks
    for sub in re.split(r"&&|\|\||[;|]", tin.get("command", "") or ""):
        try:
            tok = shlex.split(sub, comments=False)
        except ValueError:
            tok = sub.split()
        if not tok:
            continue
        verb, args = os.path.basename(tok[0]), tok[1:]
        if verb == "git" and "push" in args[:2] and any(PUSH_MAIN_RE.match(a) for a in args):
            return locks + ["deploy-main"]
        if verb in ("npm", "npx", "yarn", "pnpm") and any(a in BATTERY_SCRIPTS for a in args):
            return locks + ["battery"]
    return locks


def holder_of(d):
    try:
        with open(os.path.join(d, "holder.json")) as f:
            return json.load(f)
    except Exception:
        return {}


def holder_is_dead(h):
    """True ONLY for a holder whose root we positively know is absent (ENOENT).

    RBLD-02. This used to be `not os.path.isdir(root)`, and os.path.isdir swallows every
    OSError to return the same False as a deleted directory. So a root that EXISTS but
    cannot be stat'd — permissions stripped, a volume unmounted, a Full-Disk-Access or
    iCloud refusal on this very repo — read as "gone", and a LIVE session's lock was
    reaped out from under it. scripts/queue.py definitely_gone() already draws the line
    correctly; this ports that discipline rather than inventing one.

    The two errors are NOT symmetric. Missing a crash leaves a stale lock, which BLOCKS
    visibly and carries its own rm command. Declaring a live holder dead hands its lock to
    a second writer, silently, with nobody watching. So every ambiguous answer — cannot
    stat, no root recorded, holder file unparseable — must mean ALIVE.
    """
    root = h.get("root")
    if not root:
        return False  # a half-written or unreadable holder must keep blocking
    try:
        os.stat(root)
        return False
    except FileNotFoundError:
        return True
    except NotADirectoryError:
        return True
    except OSError as err:
        print(f"lock_guard: cannot tell whether {root} still exists ({err}) — NOT reaping",
              file=sys.stderr)
        return False


def age_of(d, h):
    """(acquired_at, seconds held). Falls back to the lock dir's mtime; an unparseable
    timestamp reads as age 0 — never stale, because guessing OLD is the unsafe direction."""
    since = h.get("acquired_at") or datetime.datetime.fromtimestamp(
        os.path.getmtime(d), UTC).isoformat(timespec="seconds")
    try:
        return since, (datetime.datetime.now(UTC) - datetime.datetime.fromisoformat(since)).total_seconds()
    except ValueError:
        return since, 0.0


def blocked_message(name, d, h):
    who = h.get("session") or "(unknown — holder file not yet written)"
    since, stale = age_of(d, h)
    msg = f"LOCK {name} held by {who} [{h.get('root', '?')}] since {since} — serialize or investigate."
    if stale > STALE_SECONDS:
        # DEVSYS-12 (#143): this used to print `rm -rf '<lock>'`, a command the guard
        # itself BLOCKS — rm is a shell write verb, so guard_core.starts_build() matches
        # it and the removal needed the very session lock it was trying to release. For a
        # lock rooted at the MAIN REPO the dead-holder reap can never fire either (that
        # root always exists), so the only printed recovery was one the harness forbade
        # and the real exit was a raw shell outside it. --release-stale is self-exempt
        # (matched_locks() triggers on npm/git-push/apply_migration, never on python3)
        # and needs no particular cwd, so it works for a worktree- AND a repo-rooted lock.
        msg = (f"STALE {msg}\nOlder than {STALE_SECONDS // 3600}h. This guard NEVER breaks a lock "
               f"whose holder directory still exists. Once you have confirmed no session holds "
               f"it:\n  python3 '{os.path.abspath(__file__)}' --release-stale {name}")
    return msg


def release_stale(name):
    """Human-confirmed removal of ONE named lock that is already past STALE_SECONDS.

    This does NOT weaken NEVER-AUTO-BREAK. Nothing here runs on its own: it is only ever
    typed by a person who has read the block message and confirmed no session holds the
    lock. The two narrowings are what keep it from becoming an auto-break in disguise —
    it takes one explicit lock NAME (never a sweep, unlike --release), and it REFUSES a
    lock younger than the stale window, so it can never be used to shove a live session
    off a lock it acquired minutes ago. Ambiguity resolves to refusal, same as the reap.
    """
    d = os.path.join(LOCK_HOME, name + ".lock")
    if not os.path.isdir(d):
        print(f"lock_guard: no lock named {name} — nothing to release", file=sys.stderr)
        return 2
    h = holder_of(d)
    since, age = age_of(d, h)
    if age <= STALE_SECONDS:
        print(f"lock_guard: REFUSING — {name} was acquired {since} by {h.get('session')} "
              f"[{h.get('root', '?')}] and is not stale ({int(age)}s < {STALE_SECONDS}s). "
              f"--release-stale only clears locks past the stale window.", file=sys.stderr)
        return 2
    shutil.rmtree(d)
    guard_log(repo_root(os.getcwd()), "lock-released-stale",
              f"{name} <- session {h.get('session')} root {h.get('root')} held since {since}")
    print(f"lock_guard: released stale lock {name} (held by {h.get('session')} since {since})")
    return 0


def acquire(name, session, root):
    d = os.path.join(LOCK_HOME, name + ".lock")
    os.makedirs(LOCK_HOME, exist_ok=True)
    for attempt in (1, 2):
        # RBLD-02: STAGE the holder, then COMMIT the directory with one atomic rename.
        # It used to be os.mkdir followed by a separate open()/write, which left a window
        # where the lock existed carrying no holder.json — a concurrent reader saw a lock
        # it could not attribute and blocked on "(unknown — holder file not yet written)".
        # Staging first means a committed lock ALWAYS carries a parseable holder, so the
        # only thing anyone can observe is a fully-formed lock or no lock.
        staged = tempfile.mkdtemp(prefix=f".{name}.staging.", dir=LOCK_HOME)
        try:
            with open(os.path.join(staged, "holder.json"), "w") as f:
                json.dump({"session": session, "root": root,
                           "acquired_at": datetime.datetime.now(UTC).isoformat(timespec="seconds")}, f)
            os.rename(staged, d)  # atomic — the whole serialization rests on this one syscall
            return None
        except OSError as err:
            shutil.rmtree(staged, ignore_errors=True)
            # A committed lock always contains holder.json, so renaming onto one fails
            # ENOTEMPTY/EEXIST — it is never the empty directory that rename would silently
            # replace. (An EMPTY lock dir can only be a half-acquired lock left by the
            # pre-RBLD-02 mkdir-then-write code, which no longer exists.) Anything else is
            # a real filesystem fault and must surface, not be read as contention.
            if err.errno not in (errno.ENOTEMPTY, errno.EEXIST, errno.ENOTDIR):
                raise
            h = holder_of(d)
            if (h.get("session") == session
                    and os.path.realpath(str(h.get("root") or "")) == os.path.realpath(root)):
                return None  # re-entrant: this session already holds it
            if attempt == 1 and holder_is_dead(h):
                guard_log(root, "lock-reaped-dead-holder",
                          f"{name} <- session {h.get('session')} root {h.get('root')} gone")
                print(f"lock_guard: reaped {name} — holder {h.get('session')} is dead "
                      f"(root {h.get('root')} no longer exists)", file=sys.stderr)
                shutil.rmtree(d, ignore_errors=True)
                continue  # one retry, then give up and block
            return blocked_message(name, d, h)
    return blocked_message(name, d, holder_of(d))


def main():
    held = sorted(glob.glob(os.path.join(LOCK_HOME, "*.lock")))
    if "--list" in sys.argv:  # strictly read-only — never reaps
        for d in held:
            h = holder_of(d)
            flag = "  DEAD-HOLDER (reaped on next blocked acquire)" if holder_is_dead(h) else ""
            print(f"{os.path.basename(d)[:-5]}\t{json.dumps(h)}{flag}")
        sys.exit(0)
    if "--release-stale" in sys.argv:
        i = sys.argv.index("--release-stale") + 1
        if i >= len(sys.argv) or sys.argv[i].startswith("-"):
            print("lock_guard: --release-stale needs a lock NAME (see --list)", file=sys.stderr)
            sys.exit(2)
        sys.exit(release_stale(sys.argv[i]))
    if "--release" in sys.argv:
        root, n = repo_root(os.getcwd()), 0
        for d in held:
            if holder_of(d).get("root") == root:
                shutil.rmtree(d)
                print(f"lock_guard: released {os.path.basename(d)[:-5]}")
                n += 1
        print(f"lock_guard: released {n} lock(s) held by {root}")
        sys.exit(0)
    raw = sys.stdin.read()
    try:
        p = json.loads(raw)
    except Exception:
        print(f"lock_guard: malformed hook payload — refusing until fixed: {raw[:200]}", file=sys.stderr)
        sys.exit(2)
    tool, tin, cwd = guard_core.normalize_payload(p)
    root = repo_root(cwd)
    names = list(dict.fromkeys(matched_locks(tool, tin, root)))
    if not names:
        sys.exit(0)
    session = guard_core.session_key(p)
    for name in names:
        msg = acquire(name, session, root)
        if msg:
            print(f"BLOCKED: {msg}", file=sys.stderr)
            sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # exit 1 is NON-blocking in Claude Code — fail closed
        print(f"lock_guard: guard crashed ({e!r}) — failing closed.", file=sys.stderr)
        sys.exit(2)

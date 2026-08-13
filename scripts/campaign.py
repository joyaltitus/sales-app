#!/usr/bin/env python3
"""Deterministic campaign preview, approval, lease and dispatch core (S4)."""
from __future__ import annotations

import datetime
import errno
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

UTC = datetime.timezone.utc
REPO_ROOT = Path(__file__).resolve().parent.parent
# CAMPAIGN_QUEUE_HOME / CAMPAIGN_LEASE_HOME / CAMPAIGN_REPO have NO default here on purpose.
# The old default silently pointed at hub-service's literal path/name — harmless in
# hub-service (it happened to be correct), a real cross-repo collision risk anywhere else.
# scripts/orchestrator.sh is the sole caller and always sets all three explicitly, per repo,
# before invoking this module (mirrors the settings.json LOCK_HOME pattern from Phase 1: the
# caller states the value, this module never derives or guesses it). A direct invocation that
# skips orchestrator.sh fails loudly here instead of silently writing into the wrong repo's
# queue/lock directory.
_REQUIRED_ENV = ("CAMPAIGN_QUEUE_HOME", "CAMPAIGN_LEASE_HOME", "CAMPAIGN_REPO")
_missing = [name for name in _REQUIRED_ENV if not os.environ.get(name)]
if _missing:
    sys.exit(
        "campaign.py: " + ", ".join(_missing) + " must be set by the caller "
        "(scripts/orchestrator.sh sets these per repo before invoking campaign.py; "
        "run via `scripts/orchestrator.sh campaign ...`, not this file directly)")
QUEUE_HOME = Path(os.environ["CAMPAIGN_QUEUE_HOME"])
LEASE_HOME = Path(os.environ["CAMPAIGN_LEASE_HOME"])
RUNNER_REQUEST = Path(os.environ.get("CAMPAIGN_RUNNER_REQUEST") or
                      Path.home() / ".claude/dev-system/runner/request-merge.sh")
LAUNCHER = Path(os.environ.get("CAMPAIGN_LAUNCHER") or REPO_ROOT / "scripts/campaign-launch.sh")
CAMPAIGN_HOME = Path(os.environ.get("CAMPAIGN_HOME") or REPO_ROOT / ".orchestrator/campaigns")
REPO = os.environ["CAMPAIGN_REPO"]
ROW_RE = re.compile(
    r"^\|\s*([A-Za-z][A-Za-z0-9-]*)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|"
    r"[^\n]*?issuecomment-(\d+)[^\n]*\|\s*$", re.MULTILINE)
TERMINAL = {"runner_requested", "completed", "parked", "failed"}
SERIAL_FLAGS = {"deploy", "migration", "battery", "merge"}


class Park(RuntimeError):
    pass


@dataclass
class Task:
    task_id: str
    order: int
    recommendation: str
    comment_id: int
    body: str
    prompt_hash: str
    harness: str | None
    exact_model: str | None
    effort: str | None
    dependencies: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    parallel_safe: list[str] = field(default_factory=list)
    serial_flags: list[str] = field(default_factory=list)
    preconditions: list[str] = field(default_factory=list)


@dataclass
class Campaign:
    issue: int
    title: str
    tier: str
    concurrency: int
    tasks: list[Task]
    questions: list[str]
    fatal_questions: list[str]


def now() -> str:
    return datetime.datetime.now(UTC).isoformat(timespec="seconds")


def park(message: str) -> int:
    print(f"PARK {message}", file=sys.stderr)
    return 3


def run_json(argv: list[str]) -> dict[str, Any]:
    proc = subprocess.run(argv, text=True, capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise Park(f"campaign source unreadable: {' '.join(argv[:3])}")
    try:
        value = json.loads(proc.stdout)
    except json.JSONDecodeError as err:
        raise Park(f"campaign source returned malformed JSON: {err}") from err
    if not isinstance(value, dict):
        raise Park("campaign source returned a non-object")
    return value


def source(issue: int) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    fixture = os.environ.get("CAMPAIGN_FIXTURE")
    if fixture:
        try:
            raw = json.loads(Path(fixture).read_text())
            return raw["issue"], raw["comments"]
        except (OSError, KeyError, json.JSONDecodeError, TypeError) as err:
            raise Park(f"campaign fixture unreadable: {err}") from err
    item = run_json(["gh", "issue", "view", str(issue), "--repo", REPO,
                     "--json", "number,title,body,labels"])
    return item, {}


def comment_body(comment_id: int, fixture_comments: dict[str, dict[str, Any]]) -> str:
    if fixture_comments:
        try:
            body = fixture_comments[str(comment_id)]["body"]
        except (KeyError, TypeError) as err:
            raise Park(f"prompt edited or unreadable: comment {comment_id}") from err
        if not isinstance(body, str):
            raise Park(f"prompt edited or unreadable: comment {comment_id}")
        return body
    data = run_json(["gh", "api", f"repos/{REPO}/issues/comments/{comment_id}"])
    body = data.get("body")
    if not isinstance(body, str):
        raise Park(f"prompt edited or unreadable: comment {comment_id}")
    return body


def route(recommendation: str) -> tuple[str | None, str | None, str | None]:
    value = recommendation.lower()
    choices = [
        ("codex sol", "codex", "gpt-5.6-sol"),
        ("codex terra", "codex", "gpt-5.6-terra"),
        ("claude opus", "claude", "opus"),
        ("claude sonnet", "claude", "sonnet"),
        ("pi/deepseek flash", "pi", "deepseek/deepseek-v4-flash"),
        ("pi/muse contributor", "pi", "muse-spark-1.2-contributor"),
    ]
    found = [(value.find(label), harness, model) for label, harness, model in choices
             if label in value]
    if not found:
        return None, None, None
    _, harness, model = min(found)
    effort = next((name for name in ("xhigh", "medium", "low") if name in value), None)
    return harness, model, effort


def csv_field(body: str, name: str) -> list[str]:
    match = re.search(rf"^(?:\*\*)?{re.escape(name)}(?:\*\*)?:\s*(.+)$", body,
                      re.IGNORECASE | re.MULTILINE)
    if not match:
        return []
    value = match.group(1).strip()
    if value.lower() in {"none", "serial", "n/a"}:
        return []
    return [item.strip().strip("`") for item in value.split(",") if item.strip()]


def parse_dependencies(body: str) -> list[str]:
    match = re.search(r"^\*\*Assumes:\*\*\s*(.+)$", body, re.IGNORECASE | re.MULTILINE)
    if not match:
        return []
    return sorted(set(re.findall(r"\bS\d+\b", match.group(1))))


def parse_preconditions(body: str) -> list[str]:
    match = re.search(r"PRECONDITIONS[^\n]*:\s*\n(.*?)(?=\n(?:BUILD|IMPLEMENT|PLAN|VERIFY|OUTPUT|FILES|PARALLEL-SAFE|SERIAL)\b)",
                      body, re.DOTALL | re.IGNORECASE)
    if not match:
        return []
    return [line.strip() for line in match.group(1).splitlines() if line.strip()]


def labels_of(item: dict[str, Any]) -> list[str]:
    labels = item.get("labels") or []
    return [str(label.get("name")) for label in labels if isinstance(label, dict)]


def parse_campaign(issue: int) -> Campaign:
    item, comments = source(issue)
    body = item.get("body")
    if not isinstance(body, str):
        raise Park("approved campaign issue has no readable body")
    rows = list(ROW_RE.finditer(body))
    if not rows:
        raise Park("issue format cannot be parsed deterministically: session queue missing")
    seen_ids: set[str] = set()
    seen_orders: set[int] = set()
    seen_comments: set[int] = set()
    tasks: list[Task] = []
    questions: list[str] = []
    fatal: list[str] = []
    for row in rows:
        task_id, order_text, recommendation, comment_text = row.groups()
        order, comment_id = int(order_text), int(comment_text)
        if task_id in seen_ids or order in seen_orders or comment_id in seen_comments:
            raise Park("issue format cannot be parsed deterministically: duplicate task/order/comment")
        seen_ids.add(task_id); seen_orders.add(order); seen_comments.add(comment_id)
        prompt = comment_body(comment_id, comments)
        harness, model, effort = route(recommendation.strip())
        files = csv_field(prompt, "FILES")
        parallel = csv_field(prompt, "PARALLEL-SAFE")
        serial = [flag.lower() for flag in csv_field(prompt, "SERIAL")]
        if not model or not harness or not effort:
            fatal.append(f"{task_id} has no exact model/harness/effort")
        if not files:
            questions.append(f"{task_id} declares no write files; it is forced serial")
        if not parallel:
            questions.append(f"{task_id} declares no parallel-safe peers")
        tasks.append(Task(task_id, order, recommendation.strip(), comment_id, prompt,
                          hashlib.sha256(prompt.encode()).hexdigest(), harness, model, effort,
                          parse_dependencies(prompt), files, parallel, serial,
                          parse_preconditions(prompt)))
    tasks.sort(key=lambda task: task.order)
    labels = labels_of(item)
    tier = next((label for label in labels if label.startswith("tier:")), "tier:unknown")
    for task in tasks:
        if task.harness == "pi" and tier != "tier:quick":
            fatal.append(f"{task.task_id} Pi fallback requires tier:quick campaign")
    explicit = re.search(r"^\*\*Campaign concurrency:\*\*\s*(\d+)\s*$", body,
                         re.IGNORECASE | re.MULTILINE)
    concurrency = int(explicit.group(1)) if explicit else (2 if tier == "tier:normal" else 1)
    if concurrency < 1 or concurrency > 4:
        fatal.append(f"campaign concurrency {concurrency} exceeds deterministic ceiling 4")
    return Campaign(issue, str(item.get("title") or f"Campaign {issue}"), tier, concurrency,
                    tasks, questions, fatal)


def append_record(record: dict[str, Any]) -> None:
    # `kind` stays first so a torn campaign line is recognisable and fails closed. The
    # older session viewer deliberately skips malformed non-campaign lines.
    record = {**record, "ts": now()}
    encoded = (json.dumps(record, separators=(",", ":")) + "\n").encode()
    QUEUE_HOME.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(QUEUE_HOME, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        os.write(fd, encoded)
    finally:
        os.close(fd)


def records() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    try:
        lines = QUEUE_HOME.read_text(errors="replace").splitlines()
    except FileNotFoundError:
        return out
    except OSError as err:
        raise Park(f"campaign journal unreadable: {err}") from err
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as err:
            if line.lstrip().startswith('{"kind":"campaign'):
                raise Park(f"malformed campaign journal line {number}") from err
            continue
        if isinstance(record, dict) and str(record.get("kind", "")).startswith("campaign"):
            if not isinstance(record.get("campaign"), int):
                raise Park(f"malformed campaign journal line {number}")
            out.append(record)
    return out


def approval(issue: int) -> dict[str, Any]:
    found = [record for record in records()
             if record.get("kind") == "campaign_approval" and record.get("campaign") == issue]
    if not found:
        raise Park(f"campaign {issue} has no approved token")
    return found[-1]


def task_state(issue: int) -> dict[str, dict[str, Any]]:
    state: dict[str, dict[str, Any]] = {}
    for record in records():
        if record.get("kind") == "campaign_task" and record.get("campaign") == issue:
            task = record.get("task")
            if isinstance(task, str):
                state[task] = record
    return state


def lease_path(issue: int) -> Path:
    return LEASE_HOME / f"commander-{issue}.lock"


def read_holder(path: Path) -> dict[str, Any]:
    try:
        value = json.loads((path / "holder.json").read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def definitely_dead(holder: dict[str, Any]) -> bool:
    root = holder.get("root")
    pid = holder.get("pid")
    if not isinstance(root, str) or not root or not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.stat(root)
    except (FileNotFoundError, NotADirectoryError):
        return True
    except OSError:
        return False
    try:
        os.kill(pid, 0)
        return False
    except ProcessLookupError:
        return True
    except (PermissionError, OSError):
        return False


def acquire_lease(issue: int, token: str, recover: bool = True, commander: str = "unknown") -> bool:
    LEASE_HOME.mkdir(parents=True, exist_ok=True)
    target = lease_path(issue)
    for attempt in (1, 2):
        staged = Path(tempfile.mkdtemp(prefix=f".commander-{issue}.staging.", dir=LEASE_HOME))
        (staged / "holder.json").write_text(json.dumps({
            "campaign": issue, "token": token, "pid": os.getpid(),
            "root": str(REPO_ROOT), "commander": commander, "acquired_at": now(),
        }))
        try:
            os.rename(staged, target)
            return attempt == 2
        except OSError as err:
            shutil.rmtree(staged, ignore_errors=True)
            if err.errno not in (errno.ENOTEMPTY, errno.EEXIST, errno.ENOTDIR):
                raise
            holder = read_holder(target)
            if attempt == 1 and recover and definitely_dead(holder):
                append_record({"kind": "campaign_audit", "campaign": issue,
                               "event": "commander_recovered", "old_token": holder.get("token")})
                shutil.rmtree(target)
                continue
            who = holder.get("token") or "unknown"
            raise Park(f"commander:{issue} held token={who}")
    raise Park(f"commander:{issue} held")


def release_lease(issue: int, token: str) -> bool:
    target = lease_path(issue)
    holder = read_holder(target)
    if holder.get("token") != token:
        return False
    shutil.rmtree(target)
    return True


def preview(campaign: Campaign) -> None:
    print(f"CAMPAIGN {campaign.issue}: {campaign.title}")
    print(f"TIER {campaign.tier}  CONCURRENCY {campaign.concurrency}")
    print("TASK ORDER HARNESS MODEL EFFORT COMMENT DEPENDS FILES PARALLEL")
    for task in campaign.tasks:
        harness = task.harness.title() if task.harness else "?"
        print(f"{task.task_id} {task.order} {harness} {task.exact_model or '?'} "
              f"{task.effort or '?'} {task.comment_id} {','.join(task.dependencies) or '-'} "
              f"{','.join(task.files) or '-'} {','.join(task.parallel_safe) or '-'}")
    print("QUESTIONS (1 batch)")
    questions = campaign.fatal_questions + campaign.questions
    if questions:
        for question in questions:
            print(f"- {question}")
    else:
        print("- none")
    print("STOP edited/unreadable prompt; ambiguous lease; undeclared parallel work; runner unavailable")


def cmd_approve(issue: int) -> int:
    campaign = parse_campaign(issue)
    preview(campaign)
    if campaign.fatal_questions:
        return park("; ".join(campaign.fatal_questions))
    token = str(uuid.uuid4())
    append_record({
        "kind": "campaign_approval", "campaign": issue, "token": token,
        "prompt_hashes": {task.task_id: task.prompt_hash for task in campaign.tasks},
        "concurrency": campaign.concurrency,
        "routing": {task.task_id: [task.harness, task.exact_model, task.effort, task.order]
                    for task in campaign.tasks},
    })
    print(f"APPROVED campaign {issue} token={token}")
    return 0


def check_parallel(tasks: list[Task]) -> None:
    for index, left in enumerate(tasks):
        for right in tasks[index + 1:]:
            if right.task_id not in left.parallel_safe or left.task_id not in right.parallel_safe:
                raise Park(f"undeclared parallel pair {left.task_id}/{right.task_id}")
            if not left.files or not right.files:
                raise Park(f"undeclared files for parallel pair {left.task_id}/{right.task_id}")
            shared = sorted(set(left.files) & set(right.files))
            if shared:
                raise Park(f"shared files for parallel pair {left.task_id}/{right.task_id}: {','.join(shared)}")
            if SERIAL_FLAGS.intersection(left.serial_flags + right.serial_flags):
                raise Park(f"serial resource in parallel pair {left.task_id}/{right.task_id}")


def run_preconditions(task: Task) -> None:
    if not task.preconditions:
        raise Park(f"preconditions unreadable: {task.task_id}")
    proc = subprocess.run(["bash", "-c", "\n".join(task.preconditions)], cwd=REPO_ROOT,
                          text=True, capture_output=True, timeout=300)
    if proc.returncode != 0:
        detail = (proc.stdout + proc.stderr).strip().splitlines()
        suffix = f" ({detail[-1]})" if detail else ""
        raise Park(f"preconditions false: {task.task_id}{suffix}")


def process_group_alive(value: Any) -> bool:
    if not isinstance(value, int) or value <= 0:
        return False
    try:
        os.killpg(value, 0)
        return True
    except ProcessLookupError:
        return False
    except (PermissionError, OSError):
        return True


# `opus` and `sonnet` are aliases the Claude CLI resolves at runtime; the served id is the
# dated model. Every other harness is launched with the exact identifier it must report back.
MODEL_FAMILIES = {"opus": "claude-opus-", "sonnet": "claude-sonnet-"}


def model_matches(requested: str, served: Any) -> bool:
    if not isinstance(served, str) or not served:
        return False
    family = MODEL_FAMILIES.get(requested)
    return served.startswith(family) if family else served == requested


def verify_approval(campaign: Campaign, approved: dict[str, Any]) -> None:
    frozen = approved.get("prompt_hashes")
    if not isinstance(frozen, dict):
        raise Park("approved campaign token is malformed")
    for task in campaign.tasks:
        if frozen.get(task.task_id) != task.prompt_hash:
            raise Park(f"prompt edited or unreadable: {task.task_id}")
    if set(frozen) != {task.task_id for task in campaign.tasks}:
        raise Park("campaign task queue changed after approval")
    # How many run at once and which model serves them are decided by the approval, not by
    # whatever the issue body says at launch time. Both are editable after approval, and an
    # edit that widens the ceiling or re-routes a task is the same threat the hashes cover.
    if approved.get("concurrency") != campaign.concurrency:
        raise Park(f"campaign concurrency changed after approval: "
                   f"{approved.get('concurrency')} -> {campaign.concurrency}")
    routing = approved.get("routing")
    if not isinstance(routing, dict):
        raise Park("approved campaign token carries no routing")
    for task in campaign.tasks:
        # Order is frozen too: it decides which tasks fill the concurrency slice.
        if routing.get(task.task_id) != [task.harness, task.exact_model, task.effort, task.order]:
            raise Park(f"routing or order changed after approval: {task.task_id}")
    if campaign.fatal_questions:
        raise Park("; ".join(campaign.fatal_questions))


def launch_one(campaign: Campaign, task: Task, previous: dict[str, Any] | None = None
               ) -> tuple[Task, dict[str, Any], dict[str, Any]]:
    resume = bool(previous and previous.get("terminal_state") == "running")
    session_id = str(previous.get("persistent_session_id")) if resume else str(uuid.uuid4())
    branch = str(previous.get("branch")) if resume else f"campaign/{campaign.issue}/{task.task_id}"
    worktree_root = Path(os.environ.get("CAMPAIGN_WORKTREE_ROOT") or REPO_ROOT / ".orchestrator/wt")
    worktree = Path(str(previous.get("worktree"))) if resume else worktree_root / f"{campaign.issue}-{task.task_id}"
    pane = str(previous.get("pane")) if resume else f"headless:{session_id}"
    CAMPAIGN_HOME.mkdir(parents=True, exist_ok=True)
    prompt_path = CAMPAIGN_HOME / f"{campaign.issue}-{task.task_id}-{task.prompt_hash[:12]}.txt"
    prompt_path.write_text(task.body)
    identity = {
        "kind": "campaign_task", "campaign": campaign.issue, "task": task.task_id,
        "worktree": str(worktree), "branch": branch, "pane": pane,
        "harness": task.harness, "exact_model": task.exact_model,
        "effort": task.effort, "persistent_session_id": session_id,
        "pr": None, "terminal_state": "running",
    }
    append_record(identity)
    child_env = os.environ.copy()
    child_env.update({
        "CAMPAIGN_SESSION_ID": session_id,
        "CAMPAIGN_EXACT_MODEL": str(task.exact_model),
        "CAMPAIGN_HARNESS": str(task.harness),
    })
    argv = [str(LAUNCHER), "--campaign", str(campaign.issue), "--task", task.task_id,
            "--worktree", str(worktree), "--branch", branch, "--pane", pane,
            "--harness", str(task.harness), "--model", str(task.exact_model),
            "--effort", str(task.effort), "--session-id", session_id,
            "--prompt", str(prompt_path)]
    if resume:
        argv.append("--resume")
    proc = subprocess.Popen(argv, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=child_env, start_new_session=True)
    running_identity = {**identity, "worker_process_group": proc.pid}
    append_record(running_identity)
    stdout, _stderr = proc.communicate()

    def launch_park(message: str) -> None:
        append_record({**running_identity, "terminal_state": "parked", "detail": message})
        raise Park(message)

    if proc.returncode != 0:
        launch_park(f"worker {task.task_id} crashed rc={proc.returncode}")
    lines = [line for line in stdout.splitlines() if line.strip()]
    if not lines:
        launch_park(f"worker {task.task_id} returned no launch result")
    try:
        result = json.loads(lines[-1])
    except json.JSONDecodeError as err:
        launch_park(f"worker {task.task_id} returned malformed launch result")
        raise AssertionError("unreachable") from err
    if result.get("model_attestation") not in ("served", "client"):
        launch_park(f"model identity unobserved for {task.task_id} on harness {task.harness}")
    if not model_matches(str(task.exact_model), result.get("actual_model")):
        launch_park(f"silent model fallback for {task.task_id}: {result.get('actual_model')}")
    # Strictly the harness's own record. Falling back to the requested id would make the
    # drift check below compare the value this commander sent with itself.
    observed_session = result.get("observed_session_id")
    if not isinstance(observed_session, str) or not observed_session:
        launch_park(f"persistent session identity unobserved for {task.task_id}")
    if task.harness != "codex" and observed_session != session_id:
        launch_park(f"persistent session identity drift for {task.task_id}")
    if result.get("attempted_action") == "merge":
        launch_park(f"worker attempted merge: {task.task_id}")
    pr = result.get("pr")
    if not isinstance(pr, int) or pr <= 0:
        launch_park(f"worker {task.task_id} produced no PR")
    terminal = {**running_identity, "pr": pr, "terminal_state": "pr",
                "served_model": result.get("actual_model"),
                "model_attestation": result.get("model_attestation"),
                "requested_session_id": session_id,
                "persistent_session_id": observed_session}
    return task, result, terminal


def cmd_start(issue: int, takeover: bool = False, commander: str = "unknown") -> int:
    if not RUNNER_REQUEST.is_file() or not os.access(RUNNER_REQUEST, os.X_OK):
        return park("runner adoption unavailable")
    if not LAUNCHER.is_file() or not os.access(LAUNCHER, os.X_OK):
        return park("campaign launcher unavailable")
    try:
        approved = approval(issue)
        campaign = parse_campaign(issue)
        verify_approval(campaign, approved)
        if commander == "pi" and campaign.tier != "tier:quick":
            raise Park("Pi commander requires tier:quick campaign")
        lease_token = str(uuid.uuid4())
        recovered = acquire_lease(issue, lease_token, recover=takeover, commander=commander)
        append_record({"kind": "campaign_audit", "campaign": issue,
                       "event": "commander_acquired", "commander": commander,
                       "token": lease_token, "takeover": takeover, "recovered": recovered})
        if takeover:
            print(f"TAKEOVER campaign {issue} token={lease_token} recovered={'yes' if recovered else 'no'}")
        try:
            state = task_state(issue)
            running = [task_id for task_id, record in state.items()
                       if record.get("terminal_state") == "running"]
            if running and not takeover:
                raise Park(f"crashed commander requires takeover: {','.join(sorted(running))}")
            if takeover:
                live_workers = [task_id for task_id in running
                                if process_group_alive(state[task_id].get("worker_process_group"))]
                if live_workers:
                    raise Park(f"worker still running after commander exit: {','.join(sorted(live_workers))}")
            pending = [task for task in campaign.tasks
                       if state.get(task.task_id, {}).get("terminal_state") not in TERMINAL]
            if not pending:
                print(f"CAMPAIGN {issue} complete")
                return 0
            completed = {task_id for task_id, record in state.items()
                         if record.get("terminal_state") in TERMINAL - {"parked", "failed"}}
            runnable = [task for task in pending if set(task.dependencies).issubset(completed)]
            if not runnable:
                raise Park("no task has satisfied dependencies")
            selected = runnable[:campaign.concurrency]
            check_parallel(selected)
            for task in selected:
                run_preconditions(task)
            results: list[tuple[Task, dict[str, Any], dict[str, Any]] | None] = [None] * len(selected)
            errors: list[BaseException] = []

            def run_selected(index: int, task: Task) -> None:
                try:
                    results[index] = launch_one(campaign, task, state.get(task.task_id))
                except BaseException as err:  # transported to the commander thread below
                    errors.append(err)

            threads = [threading.Thread(target=run_selected, args=(index, task))
                       for index, task in enumerate(selected)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            for item in results:
                if item is None:
                    continue
                task, result, terminal = item
                try:
                    runner = subprocess.run(
                        [str(RUNNER_REQUEST), "--repo", REPO, "--issue", str(issue),
                         "--pr", str(result["pr"])], text=True, capture_output=True)
                except OSError as err:
                    append_record({**terminal, "terminal_state": "parked",
                                   "detail": f"runner adoption unavailable: {err}"})
                    errors.append(Park(f"runner adoption unavailable for {task.task_id}"))
                    continue
                if runner.returncode != 0:
                    append_record({**terminal, "terminal_state": "parked",
                                   "detail": "runner adoption request failed"})
                    errors.append(Park(f"runner adoption unavailable for {task.task_id}"))
                    continue
                append_record({**terminal, "terminal_state": "runner_requested"})
                print(f"DISPATCHED {task.task_id} model={task.exact_model} pr={result['pr']} runner=requested")
            if errors:
                raise errors[0]
        finally:
            release_lease(issue, lease_token)
        return 0
    except Park as err:
        return park(str(err))


def cmd_status(issue: int) -> int:
    try:
        approved = approval(issue)
        print(f"CAMPAIGN {issue} approved token={approved.get('token')}")
        state = task_state(issue)
        if not state:
            print("no launches")
        for task, record in state.items():
            print(f"{task} {record.get('terminal_state')} model={record.get('exact_model')} "
                  f"session={record.get('persistent_session_id')} pr={record.get('pr')}")
        return 0
    except Park as err:
        return park(str(err))


def cmd_takeover(issue: int, commander: str = "unknown") -> int:
    return cmd_start(issue, takeover=True, commander=commander)


def help_text() -> None:
    print("campaign help")
    print("campaign preview <issue>")
    print("campaign approve <issue>")
    print("campaign start <issue> [--commander codex|claude|pi]")
    print("campaign status <issue>")
    print("campaign takeover <issue> [--commander codex|claude|pi]")


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"help", "-h", "--help"}:
        help_text(); return 0
    if argv[0] not in {"preview", "approve", "start", "status", "takeover"}:
        help_text(); return 2
    if len(argv) == 2:
        command, issue_text, commander = argv[0], argv[1], "unknown"
    elif (len(argv) == 4 and argv[2] == "--commander" and
          argv[0] in {"start", "takeover"} and argv[3] in {"codex", "claude", "pi"}):
        command, issue_text, commander = argv[0], argv[1], argv[3]
    else:
        return park("commander must be codex, claude, or pi")
    try:
        issue = int(issue_text)
        if issue <= 0:
            raise ValueError
    except ValueError:
        return park("issue must be a positive number")
    try:
        if command == "preview":
            preview(parse_campaign(issue)); return 0
        if command == "approve":
            return cmd_approve(issue)
        if command == "start":
            return cmd_start(issue, commander=commander)
        if command == "status":
            return cmd_status(issue)
        return cmd_takeover(issue, commander=commander)
    except Park as err:
        return park(str(err))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Harness-neutral payload, path, and session normalization for repo guards."""
from __future__ import annotations

import os
import re
import shlex
from typing import Any

FILE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
WRITE_VERBS = {"rm", "mv", "cp", "tee", "truncate", "unlink", "shred", "touch"}
REDIRECT_RE = re.compile(r"\d*>{1,2}\s*([^\s;&|]+)")
PATCH_FILE_RE = re.compile(r"^\*\*\* (?:Add|Update|Delete|Move to) File:\s*(.+?)\s*$", re.M)


def normalize_payload(payload: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    """Return canonical tool, tool input and cwd for Claude/Codex/Cursor hook payloads."""
    tool = str(payload.get("tool_name") or payload.get("tool") or "")
    if tool in {"exec_command", "shell", "Shell"}:
        tool = "Bash"
    tin = payload.get("tool_input") or payload.get("input") or {}
    if not isinstance(tin, dict):
        tin = {}
    return tool, tin, str(payload.get("cwd") or os.getcwd())


def session_key(payload: dict[str, Any]) -> str:
    """Stable per-conversation key without depending on one harness field name."""
    for key in ("session_id", "thread_id", "conversation_id"):
        value = payload.get(key)
        if value:
            return str(value)
    transcript = payload.get("transcript_path")
    if transcript:
        return "transcript:" + os.path.realpath(str(transcript))
    return "repo:" + os.path.realpath(str(payload.get("cwd") or os.getcwd()))


def resolve_root(start: str, fallback: str) -> str:
    """Nearest ancestor carrying the repo guard config."""
    path = os.path.realpath(start or fallback)
    if not os.path.isdir(path):
        path = os.path.dirname(path)
    while path and path != os.path.dirname(path):
        if os.path.isfile(os.path.join(path, ".claude", "protected-paths.json")):
            return path
        path = os.path.dirname(path)
    return fallback


def shell_write_targets(command: str) -> list[str]:
    """High-precision shell write targets; deliberately not a full shell parser."""
    command = re.sub(r"\d*>{1,2}\s*(/dev/null\b|&\d+)", " ", command)
    targets: list[str] = []
    for sub in re.split(r"&&|\|\||[;|]", command):
        targets.extend(_subcommand_write_targets(sub.strip()))
    return targets


def _subcommand_write_targets(sub: str) -> list[str]:
    if not sub:
        return []
    targets = [m.group(1).strip("'\"") for m in REDIRECT_RE.finditer(sub)]
    try:
        tokens = shlex.split(sub, comments=False)
    except ValueError:
        tokens = sub.split()
    if not tokens:
        return targets
    verb, args = os.path.basename(tokens[0]), tokens[1:]
    non_flag = [arg for arg in args if not arg.startswith("-")]
    if verb == "cp":
        if len(non_flag) >= 2:
            targets.append(non_flag[-1])
        else:
            targets.extend(non_flag)
    elif verb in WRITE_VERBS:
        targets.extend(non_flag)
    elif verb == "sed" and any(arg == "-i" or arg.startswith("-i") for arg in args):
        if non_flag:
            targets.append(non_flag[-1])
    return targets


def patch_paths(command: str) -> list[str]:
    """Every target named by a Codex apply_patch payload."""
    paths = [m.group(1).strip() for m in PATCH_FILE_RE.finditer(command)]
    # Compatibility with unified diffs if the patch transport changes spelling.
    for line in command.splitlines():
        if line.startswith("+++ b/") or line.startswith("--- a/"):
            path = line[6:].strip()
            if path and path != "/dev/null":
                paths.append(path)
    return list(dict.fromkeys(paths))


def file_paths(tool: str, tin: dict[str, Any]) -> list[str]:
    if tool == "apply_patch":
        return patch_paths(str(tin.get("command") or tin.get("patch") or ""))
    if tool not in FILE_TOOLS:
        return []
    values: list[str] = []
    one = tin.get("file_path") or tin.get("notebook_path")
    if one:
        values.append(str(one))
    for edit in tin.get("edits") or []:
        if isinstance(edit, dict) and edit.get("file_path"):
            values.append(str(edit["file_path"]))
    return list(dict.fromkeys(values))


def bash_starts_build(command: str) -> bool:
    """Whether a shell call begins or mutates a repo build session."""
    if shell_write_targets(command):
        return True
    for sub in re.split(r"&&|\|\||[;|]", command):
        try:
            tokens = shlex.split(sub, comments=False)
        except ValueError:
            tokens = sub.split()
        if not tokens:
            continue
        verb, args = os.path.basename(tokens[0]), tokens[1:]
        if verb in {"npm", "npx", "yarn", "pnpm"}:
            return True
        if verb == "git" and any(
            action in args[:2]
            for action in ("add", "commit", "push", "merge", "rebase", "cherry-pick", "rm", "mv")
        ):
            return True
    return False


def starts_build(tool: str, tin: dict[str, Any]) -> bool:
    if tool in FILE_TOOLS or tool == "apply_patch":
        return bool(file_paths(tool, tin))
    if tool == "Bash":
        return bash_starts_build(str(tin.get("command") or ""))
    return tool == "mcp__supabase__apply_migration"

#!/usr/bin/env python3
"""Prepare and check a private version-history review against a Git checkout."""

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path


CATEGORIES = {"Added", "Changed", "Deprecated", "Removed", "Fixed", "Security", "Known Issues"}
REVIEW = "bss-version-history-review.json"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    require(result.returncode == 0, result.stderr.strip() or f"Git failed: {args[0]}")
    return result.stdout


def tracked(root, name):
    require(isinstance(name, str) and name.strip(), "Missing repository-relative file path.")
    rel = Path(name)
    require(not rel.is_absolute() and ".." not in rel.parts, f"Unsafe path: {name}")
    path = root / rel
    require(path.resolve() == path and path.is_file(), f"Missing or linked file: {name}")
    git("ls-files", "--error-unmatch", "--", f":(literal){name}")
    return path


def get_commit(ref):
    return git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}").strip()


def listed(base, head):
    if base:
        require(subprocess.run(["git", "merge-base", "--is-ancestor", base, head]).returncode == 0,
                "The baseline must be an ancestor of this candidate.")
    else:
        require(git("rev-parse", "--is-shallow-repository").strip() == "false",
                "A full-history review needs a complete checkout.")
    return git("rev-list", "--topo-order", f"{base}..{head}" if base else head).splitlines()


def source_state(history):
    # Compare both index and work tree; a name-only staged or unstaged deletion still counts.
    paths = set()
    for flags in (["diff", "--cached", "--name-only", "--no-renames", "-z"],
                  ["diff", "--name-only", "--no-renames", "-z"],
                  ["ls-files", "--others", "--exclude-standard", "-z"]):
        paths.update(git(*flags).split("\0"))
    paths.discard("")
    paths.discard(history)
    require(not paths, "Candidate has changes outside its history. Review a clean candidate. " +
            ", ".join(sorted(paths)[:5]))


def read_view(root, config, content):
    if Path(config["history"]).suffix.lower() in (".md", ".markdown"):
        return content
    renderer = tracked(root, config.get("renderer"))
    result = subprocess.run([sys.executable, str(renderer)], input=content, text=True, capture_output=True)
    require(result.returncode == 0, "History view adapter failed: " + result.stderr.strip())
    return result.stdout


def layout(markdown):
    """Read the KAC period/category outline. Audience subheadings can sit below a category."""
    notes = defaultdict(list)
    periods = []
    period, category, last_date = "", "", None
    for line in markdown.splitlines():
        if line.startswith("## "):
            heading = line[3:].strip()
            if heading.casefold() in {"sources", "coverage", "sources and coverage", "evidence and limitations"}:
                period, category = "", ""
                continue
            period, category = heading, ""
            unrel = bool(re.fullmatch(r"\[?Unreleased\]?(?:\([^)]*\))?", heading, re.I))
            require(bool(periods) != unrel, "Unreleased must be the first period and occur exactly once.")
            periods.append(heading)
            dates = re.findall(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", heading)
            if dates:
                parsed = [date.fromisoformat(value) for value in dates]
                latest = max(parsed)
                require(last_date is None or latest <= last_date, "Out-of-order period: " + heading)
                last_date = latest
        elif line.startswith("### ") and period:
            category = line[4:].strip()
            require(category in CATEGORIES, "Unknown change category: " + category)
        elif period and line.startswith(("- ", "* ")):
            require(category, "Place bullets under a change category in " + period)
            notes[(category, line[2:].strip())].append(period)
    require(periods, "Missing Unreleased section in the canonical history.")
    return notes


def disposition(item, entries, label, used):
    refs = item.get("entries")
    reason = item.get("exclude")
    require(isinstance(refs, list) and all(isinstance(k, str) and k in entries for k in refs),
            f"Unknown or invalid entry reference for {label}.")
    require(isinstance(reason, str) and bool(refs) != bool(reason.strip()),
            f"Give {label} entry IDs or a specific exclusion reason.")
    used.update(refs)


def start(args, config, path, head):
    base = get_commit(args.base) if args.base is not None else None
    ids = listed(base, head)
    scope = {"schema": 1, "project": config["project"], "history": config["history"], "base": base, "head": head}
    prior = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if path.exists() and not args.restart:
        require(all(prior.get(k) == v for k, v in scope.items()),
                "Another review exists. Archive it, then run start again with --restart.")
        print("Resuming existing review:", path)
        return
    data = {**scope, "coverage": "", "records": [], "entries": {}, "reviewed": False,
            "commits": {sha: {"entries": [], "exclude": ""} for sha in ids}}
    if prior and all(prior.get(k) == scope[k] for k in ("schema", "project", "history", "base")):
        for name in ("coverage", "records", "entries", "corrections"):
            if name in prior:
                data[name] = prior[name]
        for sha in set(ids) & set(prior.get("commits", {})):
            data["commits"][sha] = prior["commits"][sha]
    if path.exists():
        import tempfile
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=REVIEW + ".previous-", delete=False) as backup:
            backup.write(path.read_bytes())
            print("Previous review retained at", backup.name)
    with path.open("w", encoding="utf-8") as stream:
        json.dump(data, stream, indent=2)
        stream.write("\n")
    print(f"Prepared {len(ids)} commit(s). Read .version-history/RUNBOOK.md and PROJECT.md, "
          f"then write the changelog and complete {path}.")


def check(config, path, root, history, head):
    require(path.is_file(), "No review. Run start --base <revision> or start --full.")
    data = json.loads(path.read_text(encoding="utf-8"))
    require(data["schema"] == 1 and data["project"] == config["project"] and data["history"] == config["history"],
            "Review belongs to another project or source.")
    require(data["head"] == head, "Candidate changed. Start a review for the new revision.")
    ids = listed(data["base"], head)
    require(set(data["commits"]) == set(ids), "Commit inventory does not match the requested range.")
    require(isinstance(data["coverage"], str) and data["coverage"].strip(), "Record reviewed sources and gaps.")
    require(data["reviewed"] is True, "Complete the maintainer review in RUNBOOK.md.")
    notes = layout(read_view(root, config, history.read_text(encoding="utf-8")))
    entries, records = data["entries"], data["records"]
    used = set()
    require(isinstance(entries, dict) and isinstance(records, list), "Invalid entries or records collection.")
    for sha in ids:
        disposition(data["commits"][sha], entries, sha[:12], used)
    for record in records:
        require(isinstance(record.get("source"), str) and record["source"].strip(), "Missing historical source.")
        disposition(record, entries, record["source"], used)
    require(used == set(entries), "Link every reviewed entry to a commit or source record.")
    accounted = set()
    for key, entry in entries.items():
        note = (entry["category"], entry["text"])
        matches = notes.get(note, [])
        if entry.get("period"):
            matches = [p for p in matches if p == entry["period"]]
        require(len(matches) == 1, f"{key}: supply the exact bullet and category; duplicate text needs its period.")
        period = matches[0]
        kind = entry["date_kind"]
        require(kind in ("unreleased", "development", "published", "undated"), f"{key}: unknown date kind.")
        require(("unreleased" in period.casefold()) == (kind == "unreleased"), f"{key}: incorrect Unreleased status.")
        if "development" in period.casefold() or "retrospective" in period.casefold():
            require(kind == "development", f"{key}: development period classified incorrectly.")
        if re.search(r"\b\d{4}-\d{2}-\d{2}\b", period) and kind != "development":
            require(kind == "published", f"{key}: dated heading needs a release record or development label.")
        if kind == "development" and re.search(r"\b\d{4}-\d{2}-\d{2}\b", period):
            require("development" in period.casefold() or "retrospective" in period.casefold(),
                    f"{key}: label dates of work as development.")
        require(isinstance(entry["evidence"], list) and entry["evidence"] and
                all(isinstance(e, str) and e.strip() for e in entry["evidence"]), f"{key}: missing evidence.")
        if kind == "published":
            proof = entry.get("publication", "")
            require(isinstance(proof, str) and re.match(
                r"^(production-deploy|published-release|release-announcement)\s+\S", proof)
                and not re.search(r"github\.com/[^ ]+/(?:commit|compare|pull|actions/runs)/", proof),
                f"{key}: cite the specific production deployment, published release or release announcement.")
        accounted.add((period, *note))
    required = {(period, *note) for note, periods in notes.items() for period in periods}
    baseline = data["base"] or head
    if baseline:
        prior = subprocess.run(["git", "show", f'{baseline}:{config["history"]}'], capture_output=True, text=True)
        if prior.returncode == 0:
            try:
                old = layout(read_view(root, config, prior.stdout))
            except ValueError:
                # During a format migration, require accounting for all current bullets.
                old = {}
            before = {(period, *note) for note, periods in old.items() for period in periods}
            vanished = before - required
            corrections = set()
            for change in data.get("corrections", []):
                require(all(isinstance(change.get(k), str) and change[k].strip()
                            for k in ("period", "category", "text", "reason", "approval")),
                        "A change to recorded history needs the old bullet, reason and approval reference.")
                corrections.add((change["period"], change["category"], change["text"]))
            lost = {row for row in vanished if not (
                "unreleased" in row[0].casefold() and (row[1], row[2]) in notes)}
            require(not lost - corrections, "Prior history was removed without a documented correction: " +
                    ", ".join(sorted(row[2] for row in lost - corrections)[:3]))
            if data["base"]:
                required -= before
    require(not required - accounted, "Canonical history has unmapped bullets: " +
            ", ".join(sorted(row[2] for row in required - accounted)[:3]))
    print(f"PASS: {config['project']}; {len(ids)} commits, {len(records)} other records, {len(entries)} entries. "
          "Evidence and publication claims were reviewed by the maintainer.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    prep = sub.add_parser("start", help="prepare a private inventory for authoring the changelog")
    scope = prep.add_mutually_exclusive_group(required=True)
    scope.add_argument("--full", action="store_true")
    scope.add_argument("--base", help="last reviewed or published commit; exclusive")
    prep.add_argument("--restart", action="store_true", help="save a backup of the previous review and begin again")
    verify = sub.add_parser("check", help="verify the candidate, categories and evidence accounting")
    verify.add_argument("--committed", action="store_true", help="require the canonical history in HEAD")
    args = parser.parse_args()
    root = Path(git("rev-parse", "--show-toplevel").strip()).resolve()
    require(Path.cwd().resolve() == root, "Run from the repository root.")
    config = json.loads((root / ".version-history/config.json").read_text(encoding="utf-8"))
    history = tracked(root, config["history"])
    source_state(config["history"])
    head = get_commit("HEAD")
    path = root / git("rev-parse", "--git-path", REVIEW).strip()
    if args.command == "start":
        start(args, config, path, head)
    else:
        if args.committed:
            require(not git("diff", "HEAD", "--name-only", "--", f':(literal){config["history"]}').strip(),
                    "Commit the reviewed history locally; refresh the review for that candidate.")
        check(config, path, root, history, head)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
        print(f"History check stopped: {error}", file=sys.stderr)
        sys.exit(1)

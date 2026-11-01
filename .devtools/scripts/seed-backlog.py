#!/usr/bin/env python3
"""Creates the labels, milestones and issues in docs/BACKLOG.md on GitHub.

Prints what it would do unless given --apply. It is safe to run twice: anything that already
exists, matched by title, is left alone. Issues are created in file order, so their numbers follow
the working order.

Delete this script and docs/BACKLOG.md once the issues exist.

    python3 .devtools/scripts/seed-backlog.py            # dry run, needs no network
    python3 .devtools/scripts/seed-backlog.py --apply    # needs gh, signed in, and a pushed repo
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

BACKLOG = Path(__file__).resolve().parents[2] / "docs" / "BACKLOG.md"
LABELS = {
    "spike": ("5319E7", "The outcome is a written answer"),
    "blocked": ("B60205", "Waiting on something outside this issue"),
}


def parse(text):
    """Returns [{title, description, issues: [{title, labels, body}]}] in file order."""
    milestones = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        title, _, rest = block.partition("\n")
        parts = re.split(r"^### ", rest, flags=re.M)
        issues = []
        for entry in parts[1:]:
            issue_title, _, body = entry.partition("\n")
            body = body.strip()
            labels = []
            match = re.match(r"Labels: (.+)\n+", body)
            if match:
                labels = [label.strip() for label in match.group(1).split(",")]
                body = body[match.end():]
            issues.append({"title": issue_title.strip(), "labels": labels, "body": body})
        milestones.append(
            {"title": title.strip(), "description": parts[0].strip(), "issues": issues}
        )
    return milestones


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def gh_json(*args):
    return json.loads(gh(*args))


def apply(milestones):
    existing_labels = {label["name"] for label in gh_json("label", "list", "--json", "name")}
    for name, (colour, description) in LABELS.items():
        if name not in existing_labels:
            gh("label", "create", name, "--color", colour, "--description", description)
            print(f"label     {name}")

    existing_milestones = {
        milestone["title"]
        for milestone in gh_json(
            "api", "--paginate", "repos/{owner}/{repo}/milestones?state=all&per_page=100"
        )
    }
    existing_issues = {
        issue["title"]
        for issue in gh_json("issue", "list", "--state", "all", "--limit", "1000", "--json", "title")
    }
    for milestone in milestones:
        if milestone["title"] not in existing_milestones:
            gh(
                "api", "repos/{owner}/{repo}/milestones",
                "-f", f"title={milestone['title']}",
                "-f", f"description={milestone['description']}",
            )
            print(f"milestone {milestone['title']}")
        for issue in milestone["issues"]:
            if issue["title"] in existing_issues:
                continue
            command = [
                "issue", "create",
                "--title", issue["title"],
                "--body", issue["body"],
                "--milestone", milestone["title"],
            ]
            for label in issue["labels"]:
                command += ["--label", label]
            gh(*command)
            print(f"issue     {issue['title']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="create them on GitHub")
    arguments = parser.parse_args()

    milestones = parse(BACKLOG.read_text())
    if arguments.apply:
        apply(milestones)
        return 0
    for milestone in milestones:
        print(f"{milestone['title']} ({len(milestone['issues'])} issues)")
        for issue in milestone["issues"]:
            print(f"  {issue['title']}")
    print(f"\n{sum(len(m['issues']) for m in milestones)} issues. Pass --apply to create them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

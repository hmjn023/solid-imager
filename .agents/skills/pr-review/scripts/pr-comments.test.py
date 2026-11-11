#!/usr/bin/env python3
"""Offline checks for the read-only review helper; no GitHub access required."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("pr-comments.sh")
THREADS = [
    {
        "id": "thread-current",
        "isResolved": False,
        "isOutdated": False,
        "comments": {"nodes": [{"body": "literal $(touch SHOULD_NOT_EXIST)\nnext line"}]},
    },
    {
        "id": "thread-resolved",
        "isResolved": True,
        "isOutdated": True,
        "comments": {"nodes": []},
    },
]

FAKE_GH = r'''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

args = sys.argv[1:]
with open(os.environ["GH_CALL_LOG"], "a") as log:
    log.write(json.dumps(args) + "\n")
if args[:2] == ["repo", "view"]:
    print(os.environ.get("FAKE_REPO", "another-owner/another-repo"))
elif args[:2] == ["pr", "view"]:
    if os.environ.get("NO_PR"):
        sys.exit(1)
    print("731")
elif args[:2] == ["api", "graphql"]:
    print(Path(os.environ["GH_FIXTURE"]).read_text(), end="")
    if os.environ.get("API_FAILURE"):
        print("page request failed", file=sys.stderr)
        sys.exit(1)
else:
    sys.exit(99)
'''


class ReviewCommentsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.log = self.root / "calls.jsonl"
        self.fixture = self.root / "threads.jsonl"
        self.fixture.write_text("".join(json.dumps(t) + "\n" for t in THREADS))
        fake = self.root / "gh"
        fake.write_text(FAKE_GH)
        fake.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": str(self.root) + os.pathsep + os.environ["PATH"],
            "GH_CALL_LOG": str(self.log),
            "GH_FIXTURE": str(self.fixture),
            "TMPDIR": str(self.root),
        }

    def run_helper(self, *args, **env):
        return subprocess.run(
            ["bash", str(SCRIPT), *args],
            cwd=self.root,
            env={**self.env, **env},
            capture_output=True,
            text=True,
            check=False,
        )

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_current_pr_keeps_thread_state_and_untrusted_text(self):
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([json.loads(line) for line in result.stdout.splitlines()], THREADS)
        self.assertFalse((self.root / "SHOULD_NOT_EXIST").exists())
        api = self.calls()[-1]
        self.assertIn("owner=another-owner", api)
        self.assertIn("repo=another-repo", api)
        self.assertIn("pr=731", api)
        self.assertIn("--paginate", api)

    def test_explicit_pr_does_not_require_a_pr_for_current_branch(self):
        result = self.run_helper("425", FAKE_REPO="same/same", NO_PR="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[:2] == ["pr", "view"] for call in self.calls()))
        self.assertIn("pr=425", self.calls()[-1])

    def test_later_api_failure_does_not_emit_partial_results(self):
        before = {path.name for path in self.root.iterdir()}
        result = self.run_helper(API_FAILURE="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("page request failed", result.stderr)
        self.assertEqual({p.name for p in self.root.iterdir()} - before, {self.log.name})

    def test_missing_pr_stops_before_query(self):
        result = self.run_helper(NO_PR="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertFalse(any(call[:2] == ["api", "graphql"] for call in self.calls()))

    def test_help_and_invalid_input_do_not_contact_github(self):
        result = self.run_helper("--help")
        self.assertEqual(result.returncode, 0)
        for args in [("0",), ("-1",), ("--repo",), ("1", "2")]:
            with self.subTest(args=args):
                self.assertEqual(self.run_helper(*args).returncode, 2)
        self.assertFalse(self.log.exists())

    def test_no_threads_is_successful_empty_output(self):
        self.fixture.write_text("")
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()

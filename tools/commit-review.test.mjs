import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const tools = path.dirname(fileURLToPath(import.meta.url));
const mockCodex = String.raw`#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const prompt = readFileSync(0, 'utf8');
const snapshot = process.cwd();
writeFileSync(process.env.MOCK_CAPTURE, JSON.stringify({
  args, prompt, snapshot,
  feature: existsSync('feature.txt') ? readFileSync('feature.txt', 'utf8') : null,
  untracked: existsSync('untracked.txt'),
  secret: existsSync('.env'),
  binary: existsSync('bytes.bin') ? [...readFileSync('bytes.bin')] : null,
  link: existsSync('example-link') ? {symlink: lstatSync('example-link').isSymbolicLink(), content: readFileSync('example-link', 'utf8')} : null,
  request: readFileSync('../review/request.txt', 'utf8'),
  patch: readFileSync('../review/changes.patch', 'utf8'),
  changed: readFileSync('../review/changed-files.txt', 'utf8'),
  gitIndexFile: process.env.GIT_INDEX_FILE ?? null,
}));
if (process.env.MOCK_MODE === 'exit') process.exit(2);
if (process.env.MOCK_MODE === 'missing') process.exit(0);
if (process.env.MOCK_MODE === 'timeout') {
  setInterval(() => {}, 1000);
} else {
  if (process.env.MOCK_MODE === 'modify-index') {
    writeFileSync(path.join(process.env.MOCK_REPO, 'feature.txt'), 'changed during review');
    execFileSync('git', ['-C', process.env.MOCK_REPO, 'add', 'feature.txt']);
  }
  if (process.env.MOCK_MODE === 'modify-head') {
    execFileSync('git', ['-C', process.env.MOCK_REPO, 'commit', '--allow-empty', '-qm', 'concurrent commit']);
  }
  const output = args[args.indexOf('--output-last-message') + 1];
  writeFileSync(output, process.env.MOCK_REPORT);
}
`;

function report() {
	const check = () => ({
		status: "PASS",
		reason: "内部修正のみで既存の構成に影響しない。",
		evidence: [
			{ path: "README.md", detail: "現在の設計と公開方針に変更はない。" },
		],
		required_actions: /** @type {string[]} */ ([]),
	});
	return { architecture: check(), mcp: check() };
}

/** @param {import('node:test').TestContext} t @param {{ initial?: boolean }} options */
function fixture(t, { initial = false } = {}) {
	const temporary = mkdtempSync(path.join(tmpdir(), "commit-review-test-"));
	t.after(() => rmSync(temporary, { recursive: true, force: true }));
	const root = path.join(temporary, "repo");
	const bin = path.join(temporary, "bin");
	mkdirSync(path.join(root, "tools"), { recursive: true });
	mkdirSync(bin);
	for (const file of [
		"commit-review.mjs",
		"commit-review-policy.md",
		"commit-review.schema.json",
	]) {
		copyFileSync(path.join(tools, file), path.join(root, "tools", file));
	}
	writeFileSync(path.join(bin, "codex"), mockCodex, { mode: 0o755 });
	writeFileSync(
		path.join(root, "README.md"),
		"# Test architecture and MCP policy\n",
	);
	/** @param {string[]} args @param {NodeJS.ProcessEnv} extraEnv */
	const git = (args, extraEnv = {}) =>
		execFileSync("git", args, {
			cwd: root,
			env: { ...process.env, ...extraEnv },
			encoding: "utf8",
		});
	git(["init", "-q"]);
	git(["config", "user.name", "Gate Test"]);
	git(["config", "user.email", "gate@example.test"]);
	git(["config", "core.hooksPath", "/dev/null"]);
	git(["add", "."]);
	if (!initial) git(["commit", "-qm", "initial"]);
	writeFileSync(path.join(root, "feature.txt"), "staged version\n");
	git(["add", "feature.txt"]);
	const capture = path.join(temporary, "capture.json");
	const reportPath = path.join(root, ".git/commit-review/last-result.json");
	const env = {
		...process.env,
		PATH: `${bin}${path.delimiter}${process.env.PATH}`,
		COMMIT_REVIEW_TIMEOUT_SECONDS: "10",
		MOCK_REPO: root,
		MOCK_CAPTURE: capture,
		MOCK_REPORT: JSON.stringify(report()),
	};
	/** @param {NodeJS.ProcessEnv} extraEnv */
	const run = (extraEnv = {}) =>
		spawnSync(process.execPath, [path.join(root, "tools/commit-review.mjs")], {
			cwd: root,
			env: { ...env, ...extraEnv },
			encoding: "utf8",
			timeout: 15000,
		});
	return { root, bin, git, run, capture, reportPath, env };
}

test("passes only a complete review of the staged snapshot, with task context and read-only CLI", (t) => {
	const f = fixture(t);
	writeFileSync(path.join(f.root, "feature.txt"), "unstaged version\n");
	writeFileSync(path.join(f.root, "untracked.txt"), "untracked");
	writeFileSync(path.join(f.root, ".env"), "local secret");
	writeFileSync(path.join(f.root, "bytes.bin"), Buffer.from([0, 10, 255, 128]));
	symlinkSync(".env", path.join(f.root, "example-link"));
	f.git(["add", "bytes.bin", "example-link"]);
	const result = f.run({
		COMMIT_REVIEW_CONTEXT: "利用者向け機能には影響しない",
		COMMIT_REVIEW_MODEL: "test-model",
	});
	assert.equal(result.status, 0, result.stderr);
	const capture = JSON.parse(readFileSync(f.capture, "utf8"));
	assert.equal(capture.feature, "staged version\n");
	assert.equal(capture.untracked, false);
	assert.equal(capture.secret, false);
	assert.deepEqual(capture.binary, [0, 10, 255, 128]);
	assert.deepEqual(capture.link, { symlink: false, content: ".env" });
	assert.equal(capture.request, "利用者向け機能には影響しない");
	assert.match(capture.patch, /staged version/);
	assert.doesNotMatch(capture.patch, /unstaged version/);
	assert.match(capture.changed, /feature.txt/);
	assert.ok(capture.args.includes("--ephemeral"));
	assert.equal(
		capture.args[capture.args.indexOf("--sandbox") + 1],
		"read-only",
	);
	assert.equal(capture.args[capture.args.indexOf("--model") + 1], "test-model");
	assert.equal(existsSync(capture.snapshot), false, "snapshot is cleaned up");
	assert.equal(
		readFileSync(path.join(f.root, "feature.txt"), "utf8"),
		"unstaged version\n",
	);
	const saved = JSON.parse(readFileSync(f.reportPath, "utf8"));
	assert.equal(saved.accepted, true);
	assert.equal(saved.tree, f.git(["write-tree"]).trim());
	assert.equal(saved.base, f.git(["rev-parse", "HEAD"]).trim());
});

for (const status of ["NEEDS_CHANGE", "UNKNOWN"]) {
	test(`blocks ${status} and displays the required action`, (t) => {
		const f = fixture(t);
		const response = report();
		response.mcp.status = status;
		response.mcp.required_actions = ["WebMCPの画面連携要件を確認する"];
		const result = f.run({ MOCK_REPORT: JSON.stringify(response) });
		assert.equal(result.status, 1);
		assert.match(result.stdout, /WebMCPの画面連携要件を確認する/);
		assert.equal(
			JSON.parse(readFileSync(f.reportPath, "utf8")).accepted,
			false,
		);
	});
}

const invalidReports = [
	{ name: "malformed JSON", response: "{" },
	{
		name: "missing check",
		response: JSON.stringify({ architecture: report().architecture }),
	},
	{
		name: "empty reason",
		response: JSON.stringify({
			...report(),
			mcp: { ...report().mcp, reason: "  " },
		}),
	},
	{
		name: "missing evidence",
		response: JSON.stringify({
			...report(),
			mcp: { ...report().mcp, evidence: [] },
		}),
	},
	{
		name: "nonexistent evidence",
		response: JSON.stringify({
			...report(),
			mcp: {
				...report().mcp,
				evidence: [{ path: "invented.ts", detail: "unsupported claim" }],
			},
		}),
	},
	{
		name: "contradictory PASS",
		response: JSON.stringify({
			...report(),
			mcp: { ...report().mcp, required_actions: ["fix something"] },
		}),
	},
	{
		name: "unexplained UNKNOWN",
		response: JSON.stringify({
			...report(),
			mcp: { ...report().mcp, status: "UNKNOWN" },
		}),
	},
];
for (const { name, response } of invalidReports) {
	test(`blocks ${name}`, (t) => {
		const f = fixture(t);
		assert.equal(f.run({ MOCK_REPORT: response }).status, 1);
		assert.equal(existsSync(f.reportPath), false);
	});
}

for (const mode of ["exit", "missing", "timeout"]) {
	test(`blocks Codex ${mode} and removes an older PASS`, (t) => {
		const f = fixture(t);
		assert.equal(f.run().status, 0);
		const result = f.run({
			MOCK_MODE: mode,
			COMMIT_REVIEW_TIMEOUT_SECONDS: mode === "timeout" ? "0.2" : "10",
		});
		assert.equal(result.status, 1);
		assert.equal(existsSync(f.reportPath), false);
	});
}

for (const mode of ["modify-index", "modify-head"]) {
	test(`rejects a PASS when ${mode} occurs during review`, (t) => {
		const f = fixture(t);
		const result = f.run({ MOCK_MODE: mode });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /changed during review/);
		assert.equal(
			JSON.parse(readFileSync(f.reportPath, "utf8")).accepted,
			false,
		);
	});
}

test("supports initial commits", (t) => {
	const f = fixture(t, { initial: true });
	const result = f.run();
	assert.equal(result.status, 0, result.stderr);
	const capture = JSON.parse(readFileSync(f.capture, "utf8"));
	assert.match(capture.patch, /staged version/);
	assert.match(capture.changed, /README.md/);
	assert.equal(JSON.parse(readFileSync(f.reportPath, "utf8")).base, null);
});

test("uses the alternate index selected by Git and removes Git variables from the reviewer", (t) => {
	const f = fixture(t);
	const index = path.join(f.root, ".git/alternate-index");
	f.git(["read-tree", "HEAD"], { GIT_INDEX_FILE: index });
	writeFileSync(path.join(f.root, "feature.txt"), "alternate index version\n");
	f.git(["add", "feature.txt"], { GIT_INDEX_FILE: index });
	const result = f.run({ GIT_INDEX_FILE: index });
	assert.equal(result.status, 0, result.stderr);
	const capture = JSON.parse(readFileSync(f.capture, "utf8"));
	assert.equal(capture.feature, "alternate index version\n");
	assert.equal(capture.gitIndexFile, null);
});

test("does not reuse a PASS for a later review", (t) => {
	const f = fixture(t);
	assert.equal(f.run().status, 0);
	const response = report();
	response.architecture.status = "NEEDS_CHANGE";
	response.architecture.required_actions = ["設計書を更新する"];
	assert.equal(f.run({ MOCK_REPORT: JSON.stringify(response) }).status, 1);
});

test("skips the LLM for an unchanged tree", (t) => {
	const f = fixture(t);
	f.git(["commit", "-qm", "feature"]);
	assert.equal(f.run().status, 0);
	assert.equal(existsSync(f.capture), false);
});

test("blocks when Codex is unavailable", (t) => {
	const f = fixture(t);
	rmSync(path.join(f.bin, "codex"));
	const gitDirectory = process.env.PATH?.split(path.delimiter).find(
		(directory) => existsSync(path.join(directory, "git")),
	);
	assert.ok(gitDirectory);
	symlinkSync(path.join(gitDirectory, "git"), path.join(f.bin, "git"));
	symlinkSync(process.execPath, path.join(f.bin, "node"));
	const result = f.run({ PATH: f.bin });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Codex review failed.*ENOENT/s);
});

test("a real Git pre-commit hook blocks and then permits a commit based on the review", (t) => {
	const f = fixture(t);
	const hooks = path.join(f.root, ".git/hooks");
	writeFileSync(
		path.join(hooks, "pre-commit"),
		`#!/bin/sh\nexec '${process.execPath}' tools/commit-review.mjs\n`,
		{ mode: 0o755 },
	);
	f.git(["config", "--unset", "core.hooksPath"]);
	const response = report();
	response.mcp.status = "NEEDS_CHANGE";
	response.mcp.required_actions = ["公開候補への追加を確認する"];
	const before = f.git(["rev-parse", "HEAD"]);
	const blocked = spawnSync("git", ["commit", "-qm", "blocked"], {
		cwd: f.root,
		env: { ...f.env, MOCK_REPORT: JSON.stringify(response) },
		encoding: "utf8",
	});
	assert.equal(blocked.status, 1);
	assert.equal(f.git(["rev-parse", "HEAD"]), before);
	const passed = spawnSync("git", ["commit", "-qm", "passed"], {
		cwd: f.root,
		env: f.env,
		encoding: "utf8",
	});
	assert.equal(passed.status, 0, passed.stderr);
	assert.notEqual(f.git(["rev-parse", "HEAD"]), before);
});

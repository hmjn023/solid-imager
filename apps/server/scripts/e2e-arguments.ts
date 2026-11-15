// Playwright takes positional file filters as well as flags that select tests.
// Consume values of other flags so a reporter, worker count or trace mode
// cannot accidentally turn a smoke run into a full dev run.
const selectionOptions = new Set([
	"--config",
	"-c",
	"--grep",
	"-g",
	"--grep-invert",
	"-G",
	"--project",
	"--last-failed",
	"--only-changed",
	"--shard",
	"--test-list",
	"--test-list-invert",
]);
const optionsWithValue = new Set([
	"--add-reporter",
	"--browser",
	"--config",
	"-c",
	"--global-timeout",
	"--grep",
	"-g",
	"--grep-invert",
	"-G",
	"--last-failed-file",
	"--max-failures",
	"--output",
	"--repeat-each",
	"--reporter",
	"--retries",
	"--run-agents",
	"--shard",
	"--test-list",
	"--test-list-invert",
	"--timeout",
	"--trace",
	"--tsconfig",
	"--ui-host",
	"--ui-port",
	"--update-source-method",
	"--workers",
	"-j",
]);
const optionsWithOptionalValue = new Set([
	"--debug",
	"--only-changed",
	"--shuffle",
	"--update-snapshots",
	"-u",
]);

export function readPlaywrightSelection(args: string[]) {
	const projects: string[] = [];
	const files: string[] = [];
	let hasSelectionOption = false;
	let listOnly = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		// Playwright passes everything after this delimiter through to the tests.
		if (arg === "--") break;
		if (!arg.startsWith("-")) {
			files.push(arg);
			continue;
		}
		const option = arg.startsWith("--")
			? arg.split("=", 1)[0]
			: arg.slice(0, 2);
		if (selectionOptions.has(option)) hasSelectionOption = true;
		if (option === "--list") listOnly = true;
		if (option === "--project") {
			if (arg !== option) {
				projects.push(arg.slice("--project=".length));
			} else {
				while (args[index + 1] && !args[index + 1].startsWith("-")) {
					projects.push(args[++index]);
				}
			}
			continue;
		}
		if (arg !== option) continue;
		const next = args[index + 1];
		if (
			optionsWithValue.has(option) ||
			(optionsWithOptionalValue.has(option) && next && !next.startsWith("-"))
		) {
			index++;
		}
	}
	return {
		projects,
		files,
		listOnly,
		hasSelection: hasSelectionOption || files.length > 0,
	};
}

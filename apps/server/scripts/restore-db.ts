/// <reference types="bun-types" />
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../src/infrastructure/logger";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

type RestoreOptions = {
	composeFile: string;
	service: string;
	input: string;
	confirmedEmptyTarget: boolean;
};

function valueAfter(args: string[], index: number, option: string): string {
	const value = args[index + 1];
	if (!value) throw new Error(`${option} requires a value`);
	return value;
}

function parseOptions(args: string[]): RestoreOptions {
	const options: RestoreOptions = {
		composeFile: path.join(repoRoot, "compose.yml"),
		service: "db",
		input: "",
		confirmedEmptyTarget: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--compose-file") {
			options.composeFile = path.resolve(
				valueAfter(args, index, "--compose-file"),
			);
			index += 1;
		} else if (argument === "--service") {
			options.service = valueAfter(args, index, "--service");
			index += 1;
		} else if (argument === "--input") {
			options.input = path.resolve(valueAfter(args, index, "--input"));
			index += 1;
		} else if (argument === "--confirm-empty-target") {
			options.confirmedEmptyTarget = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!options.input) throw new Error("--input is required");
	if (!options.confirmedEmptyTarget) {
		throw new Error("--confirm-empty-target is required for restore");
	}
	return options;
}

function composeCommand(options: RestoreOptions, command: string[]): string[] {
	return [
		"docker",
		"compose",
		"-f",
		options.composeFile,
		"exec",
		"-T",
		options.service,
		...command,
	];
}

async function runCapture(command: string[]): Promise<string> {
	const processHandle = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(processHandle.stdout).text(),
		new Response(processHandle.stderr).text(),
		processHandle.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`${command[0]} exited with ${exitCode}: ${stderr.trim()}`);
	}
	return stdout.trim();
}

async function isCustomDump(filePath: string): Promise<boolean> {
	const handle = await open(filePath, "r");
	try {
		const signature = Buffer.alloc(5);
		await handle.read(signature, 0, signature.length, 0);
		return signature.toString("ascii") === "PGDMP";
	} finally {
		await handle.close();
	}
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const databaseUser = process.env.DB_USER ?? "postgres";
	const databaseName = process.env.DB_DATABASE ?? "solid-imager";
	const inputStat = await stat(options.input);
	if (!inputStat.isFile() || inputStat.size === 0) {
		throw new Error(`Restore input must be a non-empty file: ${options.input}`);
	}

	const objectCountOutput = await runCapture(
		composeCommand(options, [
			"psql",
			"-X",
			"--username",
			databaseUser,
			"--dbname",
			databaseName,
			"--tuples-only",
			"--no-align",
			"--command",
			`WITH user_objects AS (
				SELECT class.oid
				FROM pg_catalog.pg_class class
				INNER JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
				WHERE class.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
					AND namespace.nspname = 'public'
					AND NOT EXISTS (
						SELECT 1 FROM pg_catalog.pg_depend dependency
						WHERE dependency.classid = 'pg_class'::regclass
							AND dependency.objid = class.oid
							AND dependency.deptype = 'e'
					)
				UNION ALL
				SELECT type.oid
				FROM pg_catalog.pg_type type
				INNER JOIN pg_catalog.pg_namespace namespace ON namespace.oid = type.typnamespace
				WHERE type.typtype IN ('e', 'd')
					AND namespace.nspname = 'public'
					AND NOT EXISTS (
						SELECT 1 FROM pg_catalog.pg_depend dependency
						WHERE dependency.classid = 'pg_type'::regclass
							AND dependency.objid = type.oid
							AND dependency.deptype = 'e'
					)
				UNION ALL
				SELECT procedure.oid
				FROM pg_catalog.pg_proc procedure
				INNER JOIN pg_catalog.pg_namespace namespace ON namespace.oid = procedure.pronamespace
				WHERE namespace.nspname = 'public'
					AND NOT EXISTS (
						SELECT 1 FROM pg_catalog.pg_depend dependency
						WHERE dependency.classid = 'pg_proc'::regclass
							AND dependency.objid = procedure.oid
							AND dependency.deptype = 'e'
					)
				UNION ALL
				SELECT namespace.oid
				FROM pg_catalog.pg_namespace namespace
				WHERE namespace.nspname NOT IN ('public', 'pg_catalog', 'information_schema')
					AND namespace.nspname !~ '^pg_'
			)
			SELECT count(*) FROM user_objects;`,
		]),
	);
	const objectCount = Number.parseInt(objectCountOutput, 10);
	if (!Number.isSafeInteger(objectCount) || objectCount !== 0) {
		throw new Error(
			`Restore target is not empty (${objectCountOutput || "unknown"} user objects)`,
		);
	}

	const custom = await isCustomDump(options.input);
	const restoreCommand = custom
		? [
				"pg_restore",
				"--exit-on-error",
				"--clean",
				"--if-exists",
				"--no-owner",
				"--no-privileges",
				"--username",
				databaseUser,
				"--dbname",
				databaseName,
			]
		: [
				"psql",
				"-X",
				"--set=ON_ERROR_STOP=1",
				"--username",
				databaseUser,
				"--dbname",
				databaseName,
			];
	logger.info(
		{
			input: options.input,
			format: custom ? "custom" : "plain",
			composeFile: options.composeFile,
			service: options.service,
		},
		"Starting PostgreSQL restore into verified empty target",
	);
	const processHandle = Bun.spawn(composeCommand(options, restoreCommand), {
		stdin: Bun.file(options.input).stream(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(processHandle.stdout).text(),
		new Response(processHandle.stderr).text(),
		processHandle.exited,
	]);
	void stdout;
	if (exitCode !== 0) {
		throw new Error(
			`${custom ? "pg_restore" : "psql"} exited with ${exitCode}: ${stderr.trim()}`,
		);
	}
	logger.info(
		{ input: options.input, bytes: inputStat.size },
		"PostgreSQL restore completed",
	);
}

main().catch((error: unknown) => {
	logger.error({ err: error }, "PostgreSQL restore failed");
	process.exitCode = 1;
});

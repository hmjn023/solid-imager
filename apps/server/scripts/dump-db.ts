/// <reference types="bun-types" />
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../src/infrastructure/logger";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

type DumpOptions = {
	composeFile: string;
	service: string;
	output: string;
};

function valueAfter(args: string[], index: number, option: string): string {
	const value = args[index + 1];
	if (!value) throw new Error(`${option} requires a value`);
	return value;
}

function parseOptions(args: string[]): DumpOptions {
	const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
	const options: DumpOptions = {
		composeFile: path.join(repoRoot, "compose.yml"),
		service: "db",
		output: path.resolve(process.cwd(), "backups", `backup-${timestamp}.dump`),
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
		} else if (argument === "--output") {
			options.output = path.resolve(valueAfter(args, index, "--output"));
			index += 1;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	return options;
}

async function assertAbsent(filePath: string): Promise<void> {
	try {
		await access(filePath);
		throw new Error(`Refusing to overwrite existing file: ${filePath}`);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return;
		}
		throw error;
	}
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const databaseUser = process.env.DB_USER ?? "postgres";
	const databaseName = process.env.DB_DATABASE ?? "solid-imager";
	const partialPath = `${options.output}.partial`;
	await mkdir(path.dirname(options.output), { recursive: true });
	await assertAbsent(options.output);
	await assertAbsent(partialPath);

	logger.info(
		{
			composeFile: options.composeFile,
			service: options.service,
			output: options.output,
		},
		"Starting custom-format PostgreSQL dump",
	);
	const processHandle = Bun.spawn(
		[
			"docker",
			"compose",
			"-f",
			options.composeFile,
			"exec",
			"-T",
			options.service,
			"pg_dump",
			"--username",
			databaseUser,
			"--dbname",
			databaseName,
			"--format=custom",
			"--no-owner",
			"--no-privileges",
		],
		{
			stdout: Bun.file(partialPath),
			stderr: "pipe",
		},
	);
	const stderr = await new Response(processHandle.stderr).text();
	const exitCode = await processHandle.exited;
	if (exitCode !== 0) {
		await rm(partialPath, { force: true });
		throw new Error(`pg_dump exited with ${exitCode}: ${stderr.trim()}`);
	}
	const outputStat = await stat(partialPath);
	if (outputStat.size === 0) {
		await rm(partialPath, { force: true });
		throw new Error("pg_dump produced an empty file");
	}
	await rename(partialPath, options.output);
	logger.info(
		{ output: options.output, bytes: outputStat.size },
		"PostgreSQL dump completed",
	);
}

main().catch((error: unknown) => {
	logger.error({ err: error }, "PostgreSQL dump failed");
	process.exitCode = 1;
});

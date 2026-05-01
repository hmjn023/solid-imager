import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { Cli, z } from "incur";
import { getErrorMessage } from "../utils.ts";

/**
 * Validates that a path is safe
 */
function validatePath(p: string, agent: boolean = false): string {
	if (!p) throw new Error("Path is required");
	const resolved = path.resolve(p);

	// Security: If used by an AI agent (MCP), restrict to CWD
	if (agent && !resolved.startsWith(process.cwd())) {
		throw new Error(
			`Access denied: Agent is restricted to the current working directory. Path: ${resolved}`,
		);
	}

	return resolved;
}

async function runDatabaseCommand(
	command: "pg_dump" | "psql",
	args: string[],
	options: {
		docker: boolean;
		outputFile?: string;
		inputFile?: string;
		agent?: boolean;
	},
): Promise<void> {
	const { docker, outputFile, inputFile, agent } = options;

	let spawnCmd = command;
	let spawnArgs = args;

	if (docker) {
		const containerName = process.env.DB_CONTAINER || "solid-imager-db-1";
		if (!agent) process.stdout.write(`Executing docker ${command} on ${containerName}...\n`);
		spawnCmd = "docker";
		spawnArgs = ["exec", "-i", containerName, command, ...args];
	} else {
		if (!agent) process.stdout.write(`Executing local ${command}...\n`);
	}

	const outStream = outputFile ? createWriteStream(outputFile) : null;
	const inStream = inputFile ? createReadStream(inputFile) : null;

	const child = spawn(spawnCmd, spawnArgs, {
		stdio: [inStream ? "pipe" : "ignore", outStream ? "pipe" : "inherit", "pipe"],
	});

	if (inStream && child.stdin) {
		inStream.pipe(child.stdin).on("error", (err) => {
			child.kill();
			throw err;
		});
	}

	if (outStream && child.stdout) {
		child.stdout.pipe(outStream);
	}

	let stderr = "";
	child.stderr?.on("data", (data) => (stderr += data.toString()));

	const writePromise = outStream
		? new Promise((resolve, reject) => {
				outStream.on("finish", resolve);
				outStream.on("error", reject);
			})
		: Promise.resolve();

	const exitCode = await new Promise<number>((resolve, reject) => {
		child.on("close", resolve);
		child.on("error", reject);
	});

	if (exitCode !== 0) {
		throw new Error(`${command} failed (code ${exitCode}): ${stderr}`);
	}

	await writePromise;
}

export const dumpHandler = async (c: any) => {
	if (c.options.format !== "sql") {
		return c.error({
			code: "NOT_IMPLEMENTED",
			message: `Format ${c.options.format} dump is not yet implemented natively in CLI.`,
		});
	}

	try {
		const outputPath = validatePath(c.options.output, c.agent);
		await runDatabaseCommand("pg_dump", ["-U", "postgres", "solid_imager"], {
			docker: c.options.docker,
			outputFile: outputPath,
			agent: c.agent,
		});

		return c.ok({ success: true, file: outputPath, format: c.options.format });
	} catch (e) {
		return c.error({ code: "DUMP_ERROR", message: getErrorMessage(e) });
	}
};

export const restoreHandler = async (c: any) => {
	try {
		const inputPath = validatePath(c.args.filepath, c.agent);
		await runDatabaseCommand("psql", ["-U", "postgres", "-d", "solid_imager"], {
			docker: c.options.docker,
			inputFile: inputPath,
			agent: c.agent,
		});

		return c.ok({ success: true, file: inputPath });
	} catch (e) {
		return c.error({ code: "RESTORE_ERROR", message: getErrorMessage(e) });
	}
};

export const dbCmd = Cli.create("db", {
	description: "Database operations (Local server only)",
})
	.command("dump", {
		description: "Dump the local database",
		options: z.object({
			format: z.enum(["sql", "json", "zip"]).default("sql").describe("Dump format"),
			output: z.string().default("./dump.sql").describe("Output file path"),
			docker: z.boolean().default(true).describe("Use docker exec to dump from running container"),
		}),
		run: dumpHandler,
	})
	.command("restore", {
		description: "Restore the local database",
		args: z.object({ filepath: z.string() }),
		options: z.object({
			docker: z.boolean().default(true).describe("Use docker exec to restore to running container"),
		}),
		run: restoreHandler,
	});

import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(fixtureDirectory, "../../../../");
const configPath = path.join(fixtureDirectory, "vite.config.ts");

async function run(command: string[]): Promise<void> {
	const child = Bun.spawn(command, {
		cwd: serverRoot,
		env: process.env,
		stderr: "inherit",
		stdin: "inherit",
		stdout: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) {
		throw new Error(
			`Command failed with exit code ${exitCode}: ${command.join(" ")}`,
		);
	}
}

await run([process.execPath, "x", "vite", "build", "--config", configPath]);

const preview = Bun.spawn(
	[process.execPath, "x", "vite", "preview", "--config", configPath],
	{
		cwd: serverRoot,
		env: process.env,
		stderr: "inherit",
		stdin: "inherit",
		stdout: "inherit",
	},
);

let shutdownRequested = false;
const stop = () => {
	shutdownRequested = true;
	preview.kill();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const exitCode = await preview.exited;
process.off("SIGINT", stop);
process.off("SIGTERM", stop);
if (exitCode !== 0 && !shutdownRequested) {
	throw new Error(`Tauri production preview exited with code ${exitCode}`);
}

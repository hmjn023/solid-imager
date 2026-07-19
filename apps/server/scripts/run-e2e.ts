import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

type E2eMode = "dev" | "production";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(tmpdir(), "solid-imager-e2e");
const playwrightArguments = process.argv.slice(2).filter((value) => !value.startsWith("--mode="));

function getRequestedMode(): E2eMode | "all" {
  const argument = process.argv.find((value) => value.startsWith("--mode="));
  const mode = argument?.slice("--mode=".length) ?? "all";
  if (mode === "dev" || mode === "production" || mode === "all") {
    return mode;
  }
  throw new Error("--mode must be dev, production, or all");
}

async function findAvailablePort(): Promise<string> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate an E2E port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(String(address.port));
      });
    });
  });
}

async function createEnvironment(
  mode: E2eMode,
  runtimeDir: string,
): Promise<Record<string, string>> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  );
  const [port, hmrPort] = await Promise.all([findAvailablePort(), findAvailablePort()]);
  return {
    ...inherited,
    E2E_MODE: mode,
    E2E_PORT: port,
    E2E_HMR_PORT: hmrPort,
    E2E_RUNTIME_DIR: runtimeDir,
  };
}

async function runMode(mode: E2eMode): Promise<void> {
  const runtimeDir = path.join(runtimeRoot, `${mode}-${randomUUID()}`);
  const environment = await createEnvironment(mode, runtimeDir);
  const childProcess = Bun.spawn(
    [process.execPath, "run", "test:e2e:playwright", "--", ...playwrightArguments],
    {
      cwd: appRoot,
      env: environment,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    },
  );
  const exitCode = await childProcess.exited;
  if (exitCode !== 0) {
    console.error(`E2E ${mode} failed. Runtime data kept at ${runtimeDir}`);
    process.exitCode = exitCode;
    return;
  }
  await rm(runtimeDir, { recursive: true, force: true });
}

const requestedMode = getRequestedMode();
const modes: E2eMode[] = requestedMode === "all" ? ["dev", "production"] : [requestedMode];

for (const mode of modes) {
  await runMode(mode);
  if (process.exitCode) {
    break;
  }
}

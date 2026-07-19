import { chromium, type Browser, type BrowserContext } from "playwright";
import type { BrowserMeasurement } from "./measure-dev-startup-schema";

const maximumStartupWaitMs = 120_000;

function getArgument(index: number, name: string): string {
  const value = process.argv[index];
  if (!value) {
    throw new Error(`${name} must be provided`);
  }
  return value;
}

const baseUrl = getArgument(2, "base URL");
const startedAtEpochMs = Number(getArgument(3, "start timestamp"));
if (!Number.isFinite(startedAtEpochMs)) {
  throw new Error("start timestamp must be a finite number");
}

function elapsedMs(): number {
  return Date.now() - startedAtEpochMs;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function canFetchStaticAsset(): Promise<boolean> {
  const process = Bun.spawn(
    [
      "curl",
      "--insecure",
      "--max-time",
      "1",
      "--silent",
      "--output",
      "/dev/null",
      "--write-out",
      "%{http_code}",
      `${baseUrl}/favicon.ico`,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  const [exitCode, output] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
  ]);
  const status = Number(output);
  return exitCode === 0 && Number.isInteger(status) && status >= 200 && status < 500;
}

async function waitForStaticMiddleware(): Promise<number> {
  const deadline = elapsedMs() + maximumStartupWaitMs;
  while (elapsedMs() < deadline) {
    if (await canFetchStaticAsset()) {
      return elapsedMs();
    }
    await wait(50);
  }
  throw new Error(`Dev server did not serve static assets within ${maximumStartupWaitMs}ms`);
}

async function runBrowserMeasurement(): Promise<BrowserMeasurement> {
  const staticReadyAtMs = await waitForStaticMiddleware();
  const browserSetupStartedAtMs = elapsedMs();
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const browserReadyAtMs = elapsedMs();
    const browserErrors: string[] = [];
    const serverFailures: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
    });
    page.on("response", (response) => {
      if (response.url().startsWith(baseUrl) && response.status() >= 500) {
        serverFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    const firstNavigationStartedAtMs = elapsedMs();
    const response = await page.goto(`${baseUrl}/config`, {
      waitUntil: "commit",
      timeout: 30_000,
    });
    const firstSsrHeadersAtMs = elapsedMs();
    if (!response) {
      throw new Error("First SSR navigation did not return a response");
    }
    if (response.status() >= 500) {
      throw new Error(`First SSR navigation returned HTTP ${response.status()}`);
    }
    const ssrHtml = await response.text();
    const firstSsrHtmlAtMs = elapsedMs();
    if (!ssrHtml.includes("Save Changes")) {
      throw new Error("First SSR response did not include the settings form");
    }

    await page.waitForFunction(
      () => document.documentElement.dataset.hydrated === "true",
      undefined,
      { timeout: 30_000 },
    );
    await page.getByRole("tab", { name: "AI", exact: true }).click({ timeout: 30_000 });
    await page
      .getByRole("heading", { name: "AI Service", exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
    const interactionReadyAtMs = elapsedMs();

    const isConfigGetRpcRequest = (request: { url(): string; method(): string }) => {
      const url = new URL(request.url());
      return url.pathname === "/api/rpc/config/get" && request.method() !== "OPTIONS";
    };
    const isConfigGetRpcResponse = (response: {
      url(): string;
      request(): { method(): string };
    }) => {
      const url = new URL(response.url());
      return url.pathname === "/api/rpc/config/get" && response.request().method() !== "OPTIONS";
    };
    const firstRpcRequestPromise = page
      .waitForRequest(isConfigGetRpcRequest, { timeout: 30_000 })
      .then(elapsedMs);
    const rpcResponsePromise = page.waitForResponse(isConfigGetRpcResponse, { timeout: 30_000 });
    const rpcCall = page.evaluate(async () => {
      const clientModulePath = "/src/infrastructure/api-clients/orpc-client.ts";
      const { orpc } = await import(/* @vite-ignore */ clientModulePath);
      await orpc.config.get();
    });
    const firstRpcRequestAtMs = await firstRpcRequestPromise;
    const rpcResponse = await rpcResponsePromise;
    const firstRpcResponseAtMs = elapsedMs();
    await rpcCall;
    if (!rpcResponse.ok()) {
      throw new Error(`First RPC request returned HTTP ${rpcResponse.status()}`);
    }
    if (browserErrors.length > 0) {
      throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
    }
    if (serverFailures.length > 0) {
      throw new Error(`Server failures: ${serverFailures.join(" | ")}`);
    }

    return {
      staticReadyAtMs,
      browserSetupAfterStaticReadyMs: browserReadyAtMs - browserSetupStartedAtMs,
      firstSsrHeadersAtMs,
      firstSsrHtmlAtMs,
      interactionReadyAtMs,
      firstNavigationStartedAtMs,
      firstRpcRequestAtMs,
      firstRpcResponseAtMs,
      browserErrors,
      serverFailures,
    };
  } finally {
    await Promise.allSettled([context?.close(), browser?.close()]);
  }
}

console.log(JSON.stringify(await runBrowserMeasurement()));

import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { assertSafeRuntimeDir, prepareIsolatedRuntime } from './isolated-runtime';
import {
	browserMeasurementSchema,
	type BrowserMeasurement,
} from './measure-dev-startup-schema';

type ProfileName = 'baseline' | 'without-mkcert' | 'without-devtools';

type MeasurementProfile = {
	name: ProfileName;
	disableMkcert: boolean;
	disableDevtools: boolean;
};

type WorkerMilestones = {
	viteListeningAtMs?: number;
	rpcResponseFinishedAtMs?: number;
	workerStartedAtMs?: number;
	maintenanceStartedAtMs?: number;
	workerStartCount: number;
	maintenanceStartCount: number;
	output: string;
};

const appRoot = path.resolve(import.meta.dir, '..');
const runtimeRoot = path.join(tmpdir(), 'solid-imager-dev-startup');
const outputWaitAfterRpcMs = 5_000;
const rpcResponseFinishedMessage =
	'Dev startup measurement: matched RPC response finished';

function getProfile(): MeasurementProfile {
	const requested = process.argv.find((argument) =>
		argument.startsWith('--profile='),
	)?.slice('--profile='.length);

	if (!requested || requested === 'baseline') {
		return {
			name: 'baseline',
			disableMkcert: false,
			disableDevtools: false,
		};
	}
	if (requested === 'without-mkcert') {
		return {
			name: requested,
			disableMkcert: true,
			disableDevtools: false,
		};
	}
	if (requested === 'without-devtools') {
		return {
			name: requested,
			disableMkcert: false,
			disableDevtools: true,
		};
	}
	throw new Error(
		'--profile must be baseline, without-mkcert, or without-devtools',
	);
}

async function findAvailablePort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen({ host: '127.0.0.1', port: 0 }, () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Failed to allocate a local port'));
				return;
			}
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(address.port);
			});
		});
	});
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getEnvironment(
	runtimeDir: string,
	routeTreePath: string,
	port: number,
	hmrPort: number,
	profile: MeasurementProfile,
): Record<string, string> {
	const inherited = Object.fromEntries(
		Object.entries(process.env).flatMap(([key, value]) => {
			if (
				value === undefined ||
				key === 'E2E' ||
				key.startsWith('E2E_') ||
				key.startsWith('CONFIG_') ||
				key.startsWith('DEV_STARTUP_')
			) {
				return [];
			}
			return [[key, value]];
		}),
	);

	return {
		...inherited,
		DEV_STARTUP_MEASUREMENT: '1',
		DEV_STARTUP_PORT: String(port),
		DEV_STARTUP_HMR_PORT: String(hmrPort),
		DEV_STARTUP_RUNTIME_DIR: runtimeDir,
		DEV_STARTUP_ROUTE_TREE_PATH: routeTreePath,
		DEV_STARTUP_DISABLE_MKCERT: profile.disableMkcert ? '1' : '0',
		DEV_STARTUP_DISABLE_DEVTOOLS: profile.disableDevtools ? '1' : '0',
		DB_HOST: 'pglite',
		PGLITE_DATA_DIR: path.join(runtimeDir, 'pglite'),
		CONFIG_PATH: path.join(runtimeDir, 'config.json'),
		NITRO_HOST: '127.0.0.1',
		NITRO_PORT: String(port),
		NODE_ENV: 'development',
		PORT: String(port),
	};
}

function captureMilestone(
	text: string,
	startedAt: number,
	milestones: WorkerMilestones,
): void {
	milestones.output = `${milestones.output}${text}`.slice(-20_000);
	if (
		milestones.viteListeningAtMs === undefined &&
		milestones.output.includes('➜  Local:')
	) {
		milestones.viteListeningAtMs = performance.now() - startedAt;
	}
	if (
		milestones.rpcResponseFinishedAtMs === undefined &&
		milestones.output.includes(rpcResponseFinishedMessage)
	) {
		milestones.rpcResponseFinishedAtMs = performance.now() - startedAt;
	}
	if (
		milestones.workerStartedAtMs === undefined &&
		milestones.output.includes('Job processing worker started')
	) {
		milestones.workerStartedAtMs = performance.now() - startedAt;
	}
	if (
		milestones.maintenanceStartedAtMs === undefined &&
		milestones.output.includes('Starting startup checks')
	) {
		milestones.maintenanceStartedAtMs = performance.now() - startedAt;
	}
	milestones.workerStartCount = Math.max(
		milestones.workerStartCount,
		(milestones.output.match(/Job processing worker started/g) ?? []).length,
	);
	milestones.maintenanceStartCount = Math.max(
		milestones.maintenanceStartCount,
		(milestones.output.match(/Starting startup checks/g) ?? []).length,
	);
}

async function observeOutput(
	stream: ReadableStream<Uint8Array> | null,
	startedAt: number,
	milestones: WorkerMilestones,
	signal: AbortSignal,
): Promise<void> {
	if (!stream) {
		return;
	}

	const reader = stream.getReader();
	const decoder = new TextDecoder();
	const cancelReader = () => {
		void reader.cancel();
	};
	signal.addEventListener('abort', cancelReader, { once: true });
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			captureMilestone(decoder.decode(value, { stream: true }), startedAt, milestones);
		}
		captureMilestone(decoder.decode(), startedAt, milestones);
	} catch (error) {
		if (!signal.aborted) {
			throw error;
		}
	} finally {
		signal.removeEventListener('abort', cancelReader);
		reader.releaseLock();
	}
}

async function readOutput(
	stream: ReadableStream<Uint8Array> | null,
): Promise<string> {
	if (!stream) {
		return '';
	}
	return await new Response(stream).text();
}

async function waitForWorkerMilestones(
	milestones: WorkerMilestones,
): Promise<void> {
	const deadline = performance.now() + outputWaitAfterRpcMs;
	while (
		performance.now() < deadline &&
		(milestones.rpcResponseFinishedAtMs === undefined ||
			milestones.workerStartedAtMs === undefined ||
			milestones.maintenanceStartedAtMs === undefined)
	) {
		await wait(50);
	}
}

function roundMilliseconds(value: number): number {
	return Math.round(value * 10) / 10;
}

function parseBrowserMeasurement(output: string): BrowserMeasurement {
	return browserMeasurementSchema.parse(JSON.parse(output));
}

async function runMeasurement(): Promise<void> {
	const profile = getProfile();
	const runtimeDir = path.join(runtimeRoot, `${profile.name}-${randomUUID()}`);
	assertSafeRuntimeDir(runtimeDir, runtimeRoot);
	const [port, hmrPort] = await Promise.all([
		findAvailablePort(),
		findAvailablePort(),
	]);
	const { routeTreePath } = await prepareIsolatedRuntime(runtimeDir);
	const environment = getEnvironment(
		runtimeDir,
		routeTreePath,
		port,
		hmrPort,
		profile,
	);
	const protocol = profile.disableMkcert ? 'http' : 'https';
	const baseUrl = `${protocol}://127.0.0.1:${port}`;
	const milestones: WorkerMilestones = {
		workerStartCount: 0,
		maintenanceStartCount: 0,
		output: '',
	};

	let childProcess: ReturnType<typeof Bun.spawn> | undefined;
	let browserMeasurementProcess: ReturnType<typeof Bun.spawn> | undefined;
	let outputAbortController: AbortController | undefined;
	let serverOutputTasks: Promise<void>[] = [];
	let browserStdoutTask: Promise<string> | undefined;
	let browserStderrTask: Promise<string> | undefined;
	let succeeded = false;

	try {
		const startedAt = performance.now();
		const startedAtEpochMs = Date.now();
		const spawnedChildProcess = Bun.spawn([process.execPath, 'run', 'dev'], {
			cwd: appRoot,
			env: environment,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		childProcess = spawnedChildProcess;
		outputAbortController = new AbortController();
		serverOutputTasks = [
			observeOutput(
				spawnedChildProcess.stdout,
				startedAt,
				milestones,
				outputAbortController.signal,
			),
			observeOutput(
				spawnedChildProcess.stderr,
				startedAt,
				milestones,
				outputAbortController.signal,
			),
		];

		const spawnedBrowserMeasurementProcess = Bun.spawn(
			[
				process.execPath,
				'scripts/measure-dev-startup-browser.ts',
				baseUrl,
				String(startedAtEpochMs),
			],
			{
				cwd: appRoot,
				stdout: 'pipe',
				stderr: 'pipe',
			},
		);
		browserMeasurementProcess = spawnedBrowserMeasurementProcess;
		browserStdoutTask = readOutput(spawnedBrowserMeasurementProcess.stdout);
		browserStderrTask = readOutput(spawnedBrowserMeasurementProcess.stderr);

		const completion = await Promise.race([
			spawnedBrowserMeasurementProcess.exited.then((code) => ({
				source: 'browser' as const,
				code,
			})),
			spawnedChildProcess.exited.then((code) => ({
				source: 'server' as const,
				code,
			})),
		]);
		if (completion.source === 'server') {
			throw new Error(
				`Dev server exited with code ${completion.code} before browser measurement completed`,
			);
		}

		const [browserOutput, browserErrorOutput] = await Promise.all([
			browserStdoutTask,
			browserStderrTask,
		]);
		if (completion.code !== 0) {
			throw new Error(
				`Browser measurement exited with code ${completion.code}: ${browserErrorOutput}`,
			);
		}
		const browserMeasurement = parseBrowserMeasurement(browserOutput);
		if (milestones.viteListeningAtMs === undefined) {
			throw new Error('Vite listening log was not observed');
		}

		await waitForWorkerMilestones(milestones);
		if (milestones.rpcResponseFinishedAtMs === undefined) {
			throw new Error('Dev RPC response completion was not observed');
		}
		if (milestones.workerStartedAtMs === undefined) {
			throw new Error('Background worker did not start after the first RPC');
		}
		if (milestones.maintenanceStartedAtMs === undefined) {
			throw new Error('Maintenance checks did not start after the first RPC');
		}
		if (milestones.workerStartCount !== 1) {
			throw new Error(
				`Expected one background worker start, observed ${milestones.workerStartCount}`,
			);
		}
		if (milestones.maintenanceStartCount !== 1) {
			throw new Error(
				`Expected one maintenance start, observed ${milestones.maintenanceStartCount}`,
			);
		}

		const rpcResponseFinishedAtMs = milestones.rpcResponseFinishedAtMs;
		const workerStartedAtMs = milestones.workerStartedAtMs;
		const maintenanceStartedAtMs = milestones.maintenanceStartedAtMs;
		const viteListeningAtMs = milestones.viteListeningAtMs;
		if (workerStartedAtMs < rpcResponseFinishedAtMs) {
			throw new Error('Background worker started before the first RPC response finished');
		}

		console.log(
			JSON.stringify(
				{
					profile: profile.name,
					startupToListeningMs: roundMilliseconds(viteListeningAtMs),
					startupToStaticReadyMs: roundMilliseconds(
						browserMeasurement.staticReadyAtMs,
					),
					listeningToStaticReadyMs: roundMilliseconds(
						browserMeasurement.staticReadyAtMs - viteListeningAtMs,
					),
					browserSetupAfterStaticReadyMs: roundMilliseconds(
						browserMeasurement.browserSetupAfterStaticReadyMs,
					),
					staticReadyToFirstSsrHeadersMs: roundMilliseconds(
						browserMeasurement.firstSsrHeadersAtMs -
							browserMeasurement.staticReadyAtMs,
					),
					staticReadyToFirstSsrHtmlMs: roundMilliseconds(
						browserMeasurement.firstSsrHtmlAtMs -
							browserMeasurement.staticReadyAtMs,
					),
					browserReadyToFirstSsrHeadersMs: roundMilliseconds(
						browserMeasurement.firstSsrHeadersAtMs -
							browserMeasurement.staticReadyAtMs -
							browserMeasurement.browserSetupAfterStaticReadyMs,
					),
					firstSsrHtmlToInteractiveMs: roundMilliseconds(
						browserMeasurement.interactionReadyAtMs -
							browserMeasurement.firstSsrHtmlAtMs,
					),
					firstNavigationTotalMs: roundMilliseconds(
						browserMeasurement.interactionReadyAtMs -
							browserMeasurement.firstNavigationStartedAtMs,
					),
					firstRpcRequestToResponseMs: roundMilliseconds(
						browserMeasurement.firstRpcResponseAtMs -
							browserMeasurement.firstRpcRequestAtMs,
					),
					rpcResponseFinishedToWorkerStartedMs: roundMilliseconds(
						workerStartedAtMs - rpcResponseFinishedAtMs,
					),
					rpcResponseFinishedToMaintenanceStartedMs: roundMilliseconds(
						maintenanceStartedAtMs - rpcResponseFinishedAtMs,
					),
					workerStartCount: milestones.workerStartCount,
					maintenanceStartCount: milestones.maintenanceStartCount,
				},
				null,
				2,
			),
		);
		succeeded = true;
	} finally {
		if (browserMeasurementProcess) {
			browserMeasurementProcess.kill();
			await browserMeasurementProcess.exited;
		}
		if (childProcess) {
			try {
				childProcess.kill();
			} finally {
				await childProcess.exited;
				outputAbortController?.abort();
				await Promise.all(serverOutputTasks);
			}
		}
		if (succeeded) {
			await rm(runtimeDir, { recursive: true, force: true });
		} else {
			if (milestones.output) {
				console.error(`Dev server output:\n${milestones.output}`);
			}
			if (browserStdoutTask || browserStderrTask) {
				const browserOutput = await Promise.all([
					browserStdoutTask ?? Promise.resolve(''),
					browserStderrTask ?? Promise.resolve(''),
				]);
				if (browserOutput[0]) {
					console.error(`Browser measurement output:\n${browserOutput[0]}`);
				}
				if (browserOutput[1]) {
					console.error(`Browser measurement error:\n${browserOutput[1]}`);
				}
			}
			console.error(`Measurement runtime kept at ${runtimeDir}`);
		}
	}
}

await runMeasurement();

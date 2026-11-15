import http from "node:http";

const nativeServe = Bun.serve;

// Nitro's dev server delegates to srvx without exposing Bun's idleTimeout
// option. E2E SSR and database bootstrap can legitimately take longer than
// Bun's default 10 seconds, so keep the isolated test server alive while a
// request is being processed. Bun caps this value at 255 seconds.
Bun.serve = ((options: Parameters<typeof Bun.serve>[0]) => {
	const srvxOptions = options as Parameters<typeof Bun.serve>[0] & {
		bun?: Record<string, unknown>;
	};
	const patchedOptions = {
		...options,
		bun: {
			...srvxOptions.bun,
			idleTimeout: 255,
		},
		idleTimeout: 255,
	} as unknown as Parameters<typeof Bun.serve>[0];
	return nativeServe(patchedOptions);
}) as typeof Bun.serve;

const nativeCreateServer = http.createServer as unknown as (
	...args: unknown[]
) => ReturnType<typeof http.createServer>;
http.createServer = ((...args: unknown[]) => {
	const [first, second] = args;
	const timeoutOptions = {
		headersTimeout: 255_000,
		idleTimeout: 255,
		requestTimeout: 255_000,
	};
	const normalizedArgs =
		typeof first === "function" || first === undefined
			? [timeoutOptions, first]
			: [{ ...(first as Record<string, unknown>), ...timeoutOptions }, second];
	const server = nativeCreateServer(...normalizedArgs);
	server.setTimeout(255_000);
	const timeoutServer = server as typeof server & {
		idleTimeout?: number;
		timeout?: number;
	};
	timeoutServer.idleTimeout = 255;
	timeoutServer.timeout = 255_000;
	server.requestTimeout = 255_000;
	server.headersTimeout = 255_000;
	return server;
}) as typeof http.createServer;

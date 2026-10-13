import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_ID,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("retries a failed dedicated download from Jobs after F5 and restores its media processing", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const image = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	let requests = 0;
	const server = createServer((_request, response) => {
		requests++;
		if (requests === 1) {
			response.writeHead(503);
			response.end("isolated upstream unavailable");
		} else {
			response.writeHead(200, { "Content-Type": "image/png" });
			response.end(image);
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Image server not listening");
	const input = {
		targetUrl: `http://127.0.0.1:${address.port}/${randomUUID()}.png`,
		fileName: `download-retry-${randomUUID()}.png`,
		sourceUrls: [`https://example.invalid/recovery/${randomUUID()}`],
		cookies: [{ name: "auth", value: "private-download-e2e" }],
		userAgent: "private-download-agent",
	};
	let id: string | undefined;
	try {
		id = (
			await client.downloads.start({
				mediaSourceId: E2E_SOURCE_ID,
				items: [input],
			})
		).runIds[0];
		const get = () => client.downloads.get({ id: id ?? "" });
		await expect
			.poll(async () => (await get()).status, { timeout: 30_000 })
			.toBe("failed");
		expect((await get()).attemptCount).toBe(1);
		expect(JSON.stringify(await get())).not.toMatch(
			/private-download|cookies|leaseToken|sourcePath|checkpoint/,
		);
		await page.goto("/jobs");
		await waitForAppHydration(page);
		await page.reload();
		await waitForAppHydration(page);
		const select = () =>
			page
				.getByRole("button", { name: new RegExp(`job ${id?.slice(0, 8)}$`) })
				.click();
		await select();
		await page
			.getByRole("button", { name: "Retry job", exact: true })
			.filter({ visible: true })
			.click();
		await expect
			.poll(async () => (await get()).status, { timeout: 60_000 })
			.toBe("completed");
		const completed = await get();
		expect(completed.attemptCount).toBe(2);
		expect(completed.mediaIds).toHaveLength(1);
		expect(requests).toBe(2);
		const mediaId = completed.mediaIds[0];
		await expect
			.poll(
				async () =>
					(await client.processing.get({ mediaId })).steps
						.filter(
							(step) => step.kind === "metadata" || step.kind === "thumbnail",
						)
						.every((step) => step.status === "completed"),
				{ timeout: 30_000 },
			)
			.toBe(true);
		expect(
			(
				await client.media.getDetails({ sourceId: E2E_SOURCE_ID, mediaId })
			).urls.map((url) => url.url),
		).toEqual(expect.arrayContaining([input.targetUrl, ...input.sourceUrls]));
		await page.reload();
		await waitForAppHydration(page);
		await select();
		const processing = page
			.getByRole("region", { name: "Current media processing", exact: true })
			.filter({ visible: true });
		await expect(processing).toContainText("MetadataCompleted");
		await expect(processing).toContainText("ThumbnailsCompleted");
	} finally {
		try {
			if (id) {
				const run = await client.downloads.get({ id });
				if (run.status === "pending" || run.status === "in_progress")
					await client.downloads.cancel({ id });
			}
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	}
});

test("cancels an in-flight download after job SSE reconnect and fences late bytes", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const image = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	let response: ServerResponse | undefined;
	let notifyStarted!: () => void;
	const started = new Promise<void>((resolve) => {
		notifyStarted = resolve;
	});
	const server = createServer((_request, pending) => {
		response = pending;
		notifyStarted();
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Image server not listening");
	let id: string | undefined;
	try {
		id = (
			await client.downloads.start({
				mediaSourceId: E2E_SOURCE_ID,
				items: [
					{ targetUrl: `http://127.0.0.1:${address.port}/${randomUUID()}.png` },
				],
			})
		).runIds[0];
		await started;
		const stream = /\/api\/rpc\/jobs\/events(?:\?|$)/;
		let attempts = 0;
		await page.route(stream, async (route) => {
			attempts++;
			if (attempts === 1)
				await route.fulfill({
					status: 200,
					contentType: "text/event-stream",
					body: "",
				});
			else await route.continue();
		});
		const reconnected = page.waitForResponse(
			(reply) =>
				stream.test(reply.url()) && attempts >= 2 && reply.status() === 200,
		);
		await page.goto("/jobs");
		await waitForAppHydration(page);
		await reconnected;
		await page.unroute(stream);
		await page
			.getByRole("button", { name: new RegExp(`job ${id.slice(0, 8)}$`) })
			.click();
		await page
			.getByRole("button", { name: "Cancel job", exact: true })
			.filter({ visible: true })
			.click();
		await expect
			.poll(async () =>
				Boolean(
					(await client.downloads.get({ id: id ?? "" })).cancelRequestedAt,
				),
			)
			.toBe(true);
		response?.writeHead(200, { "Content-Type": "image/png" });
		response?.end(image);
		await expect
			.poll(async () => (await client.downloads.get({ id: id ?? "" })).status, {
				timeout: 30_000,
			})
			.toBe("cancelled");
		expect((await client.downloads.get({ id })).mediaIds).toHaveLength(0);
		await page.reload();
		await waitForAppHydration(page);
		await page
			.getByRole("button", { name: new RegExp(`job ${id.slice(0, 8)}$`) })
			.click();
		expect((await client.jobs.get({ id })).status).toBe("cancelled");
	} finally {
		response?.end();
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
});

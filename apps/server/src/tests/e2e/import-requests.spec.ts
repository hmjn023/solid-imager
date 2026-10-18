import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { generateMediaFilename } from "@solid-imager/core/domain/media/utils/filename-utils";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("approves a persisted import after F5, downloads once and retains recovery URLs", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const image = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	let downloads = 0;
	const server = createServer((request, response) => {
		// Inbox previews are separate browser reads. Count only the real worker's preserved context.
		if (request.headers["user-agent"] === "private-e2e-agent") downloads++;
		response.writeHead(200, { "Content-Type": "image/png" });
		response.end(image);
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Image fixture did not listen");
	const item = {
		targetUrl: `http://127.0.0.1:${address.port}/${randomUUID()}.png`,
		fileName: `e2e-import-${randomUUID()}.png`,
		sourceUrls: [`https://example.invalid/recovery/${randomUUID()}`],
		cookies: [{ name: "auth", value: "private-e2e-auth" }],
		userAgent: "private-e2e-agent",
	};
	let requestId: string | undefined;
	try {
		expect(await client.imports.bulkAdd({ items: [item] })).toMatchObject({
			addedCount: 1,
		});
		const pending = (await client.imports.listPending()).find(
			(row) => row.item.targetUrl === item.targetUrl,
		);
		if (!pending) throw new Error("Import inbox lost the request");
		requestId = pending.id;
		expect(JSON.stringify(pending)).not.toMatch(
			/private-e2e|cookies|userAgent/,
		);
		const fileName = generateMediaFilename(item, ".png");
		expect(
			(await client.processing.list({ query: fileName, limit: 25, offset: 0 }))
				.items,
		).toHaveLength(0);
		expect(downloads).toBe(0);
		await page.goto("/search");
		await waitForAppHydration(page);
		await page.reload();
		await waitForAppHydration(page);
		await page.getByRole("button", { name: /Import inbox/ }).click();
		const dialog = page.getByRole("dialog").filter({
			has: page.getByRole("heading", { name: "Import inbox", exact: true }),
		});
		await expect(dialog).toContainText(item.targetUrl);
		await dialog
			.getByRole("combobox", { name: /Target source/ })
			.selectOption(E2E_SOURCE_ID);
		await dialog
			.getByRole("button", { name: "Import (1)", exact: true })
			.click();
		await expect(dialog).toHaveCount(0);
		await expect
			.poll(async () =>
				(await client.imports.listPending()).some(
					(row) => row.id === requestId,
				),
			)
			.toBe(false);
		expect(
			await client.imports.process({
				jobIds: [requestId],
				targetSourceId: E2E_SOURCE_ID,
			}),
		).toMatchObject({ processedCount: 0 });
		const find = () =>
			client.processing.list({ query: fileName, limit: 25, offset: 0 });
		await expect
			.poll(
				async () => {
					const media = (await find()).items[0];
					return ["metadata", "thumbnail"].every(
						(kind) =>
							media?.steps.find((step) => step.kind === kind)?.status ===
							"completed",
					);
				},
				{ timeout: 60_000 },
			)
			.toBe(true);
		const processed = (await find()).items[0];
		const details = await client.media.getDetails({
			sourceId: E2E_SOURCE_ID,
			mediaId: processed.mediaId,
		});
		expect(details.urls.map((url) => url.url)).toEqual(
			expect.arrayContaining([...item.sourceUrls, item.targetUrl]),
		);
		expect(downloads).toBe(1);
		expect(
			(await client.jobs.list({ limit: 200, offset: 0 })).items.some(
				(job) => job.id === requestId || job.type === "import_request",
			),
		).toBe(false);
	} finally {
		if (requestId) await client.imports.cancel({ jobIds: [requestId] });
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
});

test("reconnects the import stream and recovers pending requests from the database", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const item = {
		targetUrl: `${baseURL}/api/sources/${E2E_SOURCE_ID}/${E2E_PRIMARY_MEDIA_ID}?pending=${randomUUID()}`,
	};
	await client.imports.bulkAdd({ items: [item] });
	const pending = (await client.imports.listPending()).find(
		(row) => row.item.targetUrl === item.targetUrl,
	);
	if (!pending) throw new Error("Missing pending request");
	let attempts = 0;
	const stream = /\/api\/rpc\/imports\/events(?:\?|$)/;
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
	try {
		const reconnected = page.waitForResponse(
			(response) =>
				stream.test(response.url()) &&
				attempts >= 2 &&
				response.status() === 200,
		);
		await page.goto("/search");
		await waitForAppHydration(page);
		await reconnected;
		await page.unroute(stream);
		await page.getByRole("button", { name: /Import inbox/ }).click();
		const dialog = page.getByRole("dialog").filter({
			has: page.getByRole("heading", { name: "Import inbox", exact: true }),
		});
		await expect(dialog).toContainText(item.targetUrl);
		await dialog.getByRole("button", { name: "Close", exact: true }).click();
		await client.imports.cancel({ jobIds: [pending.id] });
		await expect
			.poll(async () =>
				(await client.imports.listPending()).some(
					(row) => row.id === pending.id,
				),
			)
			.toBe(false);
		await page.reload();
		await waitForAppHydration(page);
		await expect(
			page.getByRole("button", { name: /Import inbox/ }),
		).toBeDisabled();
	} finally {
		await client.imports.cancel({ jobIds: [pending.id] });
	}
});

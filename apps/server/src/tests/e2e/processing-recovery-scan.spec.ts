import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { E2E_SOURCE_NAME } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("finds an unrequested metadata step and queues real file processing from Jobs", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const fileName = "e2e-scroll-0599.png";
	const before = (
		await client.processing.list({ query: fileName, limit: 25, offset: 0 })
	).items[0];
	expect(before.steps.find((step) => step.kind === "metadata")?.status).toBe(
		"not_requested",
	);
	await page.goto("/jobs?view=processing");
	await waitForAppHydration(page);
	await page
		.getByLabel("Search media processing", { exact: true })
		.fill(fileName);
	const recovery = page.getByRole("region", {
		name: "Recover unfinished processing",
		exact: true,
	});
	await recovery.getByRole("button", { name: /^Recovery source/ }).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await recovery.getByRole("button", { name: /^Recovery step/ }).click();
	await page.getByRole("option", { name: "Thumbnails", exact: true }).click();
	await recovery.getByRole("button", { name: /^Recovery step/ }).click();
	await page.getByRole("option", { name: "Metadata", exact: true }).click();
	await expect(
		recovery.getByRole("button", { name: "Queue unfinished", exact: true }),
	).toBeDisabled();
	await recovery
		.getByRole("button", { name: "Find unfinished", exact: true })
		.click();
	await expect(recovery.getByRole("status")).toContainText(
		"Scan complete: 1 unfinished steps found.",
	);
	await expect(recovery.getByRole("status")).toContainText("Not requested: 1");
	await recovery
		.getByRole("button", { name: "Queue unfinished", exact: true })
		.click();
	await expect(recovery.getByRole("status")).toContainText(
		"1 steps queued in 1 batches.",
	);
	await expect
		.poll(
			async () =>
				(await client.processing.get({ mediaId: before.mediaId })).steps.find(
					(step) => step.kind === "metadata",
				)?.status,
			{ timeout: 30_000 },
		)
		.toBe("completed");
	const after = await client.processing.get({ mediaId: before.mediaId });
	for (const kind of ["thumbnail", "tagging", "ccip"] as const) {
		expect(after.steps.find((step) => step.kind === kind)?.requestId).toBe(
			before.steps.find((step) => step.kind === kind)?.requestId,
		);
	}
	expect(
		(await client.jobs.list({ limit: 200, offset: 0 })).items.some(
			(job) => job.type === "metadata_extraction_parent",
		),
	).toBe(true);
	await recovery
		.getByRole("button", { name: "Find unfinished", exact: true })
		.click();
	await expect(recovery.getByRole("status")).toContainText(
		"Scan complete: 0 unfinished steps found.",
	);
	await page.reload();
	await waitForAppHydration(page);
	await page
		.getByLabel("Search media processing", { exact: true })
		.fill(fileName);
	await page
		.getByRole("button", {
			name: `Processing details for ${fileName}`,
			exact: true,
		})
		.click();
	await expect(
		page
			.getByRole("region", { name: "Media processing details", exact: true })
			.filter({ visible: true })
			.getByRole("region", { name: "Metadata", exact: true }),
	).toContainText("Completed");
	// The same shared screen must also initialize correctly after SPA navigation.
	await page
		.getByRole("link", { name: "Library", exact: true })
		.first()
		.click();
	await page.getByRole("link", { name: "Jobs", exact: true }).first().click();
	await page
		.getByRole("tab", { name: "Media processing", exact: true })
		.click();
	await expect(recovery).toBeVisible();
	await page.setViewportSize({ width: 375, height: 812 });
	await expect(
		recovery.getByRole("button", { name: "Find unfinished", exact: true }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.screenshot({
		path: `/tmp/processing-recovery-${process.env.E2E_MODE}-375.png`,
		fullPage: true,
	});
});

test("queues an unrequested individual metadata step while preserving the other steps", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const fileName = "e2e-scroll-0600.png";
	const before = (
		await client.processing.list({ query: fileName, limit: 25, offset: 0 })
	).items[0];
	await page.goto("/jobs?view=processing");
	await waitForAppHydration(page);
	await page
		.getByLabel("Search media processing", { exact: true })
		.fill(fileName);
	await page
		.getByRole("button", {
			name: `Processing details for ${fileName}`,
			exact: true,
		})
		.click();
	const details = page
		.getByRole("region", { name: "Media processing details", exact: true })
		.filter({ visible: true });
	await details
		.getByRole("button", { name: "Queue Metadata", exact: true })
		.click();
	await expect
		.poll(
			async () =>
				(await client.processing.get({ mediaId: before.mediaId })).steps.find(
					(step) => step.kind === "metadata",
				)?.status,
			{ timeout: 30_000 },
		)
		.toBe("completed");
	const after = await client.processing.get({ mediaId: before.mediaId });
	for (const kind of ["thumbnail", "tagging", "ccip"] as const)
		expect(after.steps.find((step) => step.kind === kind)?.requestId).toBe(
			before.steps.find((step) => step.kind === kind)?.requestId,
		);
});

test("retains partial queue progress after an unavailable continuation and allows a fresh scan", async ({
	page,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/processing/enqueueRecovery");
	browserHealth.allowConsole(/server responded with a status of 503/);
	const example = {
		mediaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		fileName: "unfinished.png",
		sourceName: "Fixture",
		reason: "not_requested",
	};
	await page.route(/\/api\/rpc\/processing\/scanRecovery(?:\?|$)/, (route) =>
		route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({
				json: {
					scanned: 1,
					items: [example],
					queued: 0,
					jobId: null,
					cursor: null,
				},
			}),
		}),
	);
	let calls = 0;
	await page.route(
		/\/api\/rpc\/processing\/enqueueRecovery(?:\?|$)/,
		(route) => {
			calls++;
			return calls === 1
				? route.fulfill({
						contentType: "application/json",
						body: JSON.stringify({
							json: {
								scanned: 100,
								items: [example],
								queued: 100,
								jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
								cursor: {
									before: "2026-01-01T00:00:00.000000",
									afterId: example.mediaId,
								},
							},
						}),
					})
				: route.fulfill({
						status: 503,
						contentType: "application/json",
						body: JSON.stringify({ message: "Service unavailable" }),
					});
		},
	);
	await page.goto("/jobs?view=processing");
	await waitForAppHydration(page);
	const recovery = page.getByRole("region", {
		name: "Recover unfinished processing",
		exact: true,
	});
	await recovery
		.getByRole("button", { name: "Find unfinished", exact: true })
		.click();
	await recovery
		.getByRole("button", { name: "Queue unfinished", exact: true })
		.click();
	await expect(recovery.getByRole("status")).toContainText(
		"Stopped after checking 100 media and queuing 100 steps",
	);
	expect(calls).toBe(2);
	await recovery
		.getByRole("button", { name: "Find unfinished", exact: true })
		.click();
	await expect(recovery.getByRole("status")).toContainText(
		"Scan complete: 1 unfinished steps found.",
	);
});

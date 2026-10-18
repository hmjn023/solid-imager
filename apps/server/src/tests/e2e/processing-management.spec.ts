import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { syncFixtureSource } from "./support/source-sync";
import { expect, test, waitForAppHydration } from "./support/test";

const sourcesEvents = /\/api\/rpc\/sources\/events(?:\?|$)/;
const processingList = /\/api\/rpc\/processing\/list(?:\?|$)/;

test("recovers a failed AI step without a generic job and restores its state after F5", async ({
	page,
	context,
	baseURL,
}) => {
	test.setTimeout(120_000);
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const original = await client.config.get();
	const fileName = `e2e-processing-management-${randomUUID()}.png`;
	try {
		// Exercise a real unavailable remote service, then recover through real native inference.
		await client.config.update({
			...original,
			ai: { ...original.ai, baseUrl: "http://127.0.0.1:1", timeoutMs: 1000 },
			jobs: { ...original.jobs, enableAutoTagging: true },
		});
		await copyFile(
			getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
			path.join(getE2eMediaDir(), fileName),
		);
		await syncFixtureSource(context);
		const find = () =>
			client.processing.list({ query: fileName, limit: 25, offset: 0 });
		await expect
			.poll(
				async () =>
					(await find()).items[0]?.steps.find((step) => step.kind === "tagging")
						?.status,
				{ timeout: 30_000 },
			)
			.toBe("failed");
		const before = (await find()).items[0];
		expect(
			(await client.jobs.list({ limit: 200, offset: 0 })).items.some(
				(job) => job.targetMediaId === before.mediaId,
			),
		).toBe(false);
		await page.goto("/jobs?view=processing");
		await waitForAppHydration(page);
		await page
			.getByLabel("Search media processing", { exact: true })
			.fill(fileName);
		const select = () =>
			page
				.getByRole("button", {
					name: `Processing details for ${fileName}`,
					exact: true,
				})
				.click();
		await select();
		const details = () =>
			page
				.getByRole("region", { name: "Media processing details", exact: true })
				.filter({ visible: true });
		await expect(
			details().getByRole("region", { name: "AI tagging", exact: true }),
		).toContainText("Failed");
		await expect(
			details().getByRole("region", { name: "Metadata", exact: true }),
		).toContainText("Completed");
		await expect(details()).toContainText("Attempts");
		await expect(details()).toContainText("Next run");
		await page.reload();
		await waitForAppHydration(page);
		await expect(
			page.getByRole("tab", { name: "Media processing", exact: true }),
		).toHaveAttribute("aria-selected", "true");
		await page
			.getByLabel("Search media processing", { exact: true })
			.fill(fileName);
		await select();
		await expect(
			details().getByRole("region", { name: "AI tagging", exact: true }),
		).toContainText("Failed");
		await client.config.update(original);
		await details()
			.getByRole("button", { name: "Retry AI tagging", exact: true })
			.click();
		await expect(
			details().getByRole("region", { name: "AI tagging", exact: true }),
		).toContainText("Completed", { timeout: 60_000 });
		const after = await client.processing.get({ mediaId: before.mediaId });
		for (const kind of ["metadata", "thumbnail"] as const) {
			const previous = before.steps.find((step) => step.kind === kind);
			expect(after.steps.find((step) => step.kind === kind)?.requestId).toBe(
				previous?.requestId,
			);
			expect(after.steps.find((step) => step.kind === kind)?.attemptCount).toBe(
				previous?.attemptCount,
			);
		}
		await page.reload();
		await waitForAppHydration(page);
		await page
			.getByLabel("Search media processing", { exact: true })
			.fill(fileName);
		await select();
		await expect(
			details().getByRole("region", { name: "AI tagging", exact: true }),
		).toContainText("Completed");
		await page.screenshot({
			path: `/tmp/processing-management-${process.env.E2E_MODE}-${test.info().project.name}.png`,
			fullPage: true,
		});
	} finally {
		await client.config.update(original);
	}
});

test("preserves search, selection and focus when source SSE reconnects and refreshes processing", async ({
	page,
	context,
}) => {
	await page.goto("/jobs");
	await waitForAppHydration(page);
	let attempts = 0;
	await page.route(sourcesEvents, async (route) => {
		attempts++;
		if (attempts === 1) {
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: "",
			});
			return;
		}
		await route.continue();
	});
	const reconnected = page.waitForResponse(
		(response) =>
			sourcesEvents.test(response.url()) &&
			attempts >= 2 &&
			response.status() === 200,
	);
	await page
		.getByRole("tab", { name: "Media processing", exact: true })
		.click();
	const search = page.getByLabel("Search media processing", { exact: true });
	await search.fill("e2e-primary");
	const selected = page.getByRole("button", {
		name: `Processing details for ${E2E_PRIMARY_FILE_NAME}`,
		exact: true,
	});
	await selected.click();
	await search.focus();
	await expect(search).toBeFocused();
	await reconnected;
	await page.unroute(sourcesEvents);
	const fileName = `e2e-primary-processing-sse-${randomUUID()}.png`;
	await copyFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
		path.join(getE2eMediaDir(), fileName),
	);
	await syncFixtureSource(context);
	await expect(
		page.getByRole("button", {
			name: `Processing details for ${fileName}`,
			exact: true,
		}),
	).toBeVisible({ timeout: 30_000 });
	await expect(search).toHaveValue("e2e-primary");
	await expect(search).toBeFocused();
	await expect(selected).toHaveAttribute("aria-pressed", "true");
	await expect(
		page
			.getByRole("region", { name: "Media processing details", exact: true })
			.filter({ visible: true }),
	).toContainText(E2E_PRIMARY_FILE_NAME);
	const width = await page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		viewport: innerWidth,
	}));
	expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});

test("recovers an unavailable processing API without losing the search input", async ({
	page,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/processing/list");
	browserHealth.allowConsole(/server responded with a status of 503/);
	await page.route(processingList, (route) =>
		route.fulfill({
			status: 503,
			contentType: "application/json",
			body: JSON.stringify({ message: "Service unavailable" }),
		}),
	);
	await page.goto("/jobs?view=processing");
	await waitForAppHydration(page);
	const search = page.getByLabel("Search media processing", { exact: true });
	await search.fill("e2e-primary");
	await expect(
		page.getByText("処理状態を取得できませんでした", { exact: true }),
	).toBeVisible({ timeout: 20_000 });
	await page.unroute(processingList);
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(
		page.getByRole("button", {
			name: `Processing details for ${E2E_PRIMARY_FILE_NAME}`,
			exact: true,
		}),
	).toBeVisible();
	await expect(search).toHaveValue("e2e-primary");
});

test("shows four processing details at 375px without page overflow", async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto("/jobs?view=processing");
	await waitForAppHydration(page);
	await page
		.getByLabel("Search media processing", { exact: true })
		.fill(E2E_PRIMARY_FILE_NAME);
	await page
		.getByRole("button", {
			name: `Processing details for ${E2E_PRIMARY_FILE_NAME}`,
			exact: true,
		})
		.click();
	const details = page
		.getByRole("region", { name: "Media processing details", exact: true })
		.filter({ visible: true });
	for (const name of [
		"Metadata",
		"Thumbnails",
		"AI tagging",
		"Full-image CCIP",
	]) {
		await expect(
			details.getByRole("region", { name, exact: true }),
		).toBeVisible();
	}
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.screenshot({
		path: `/tmp/processing-management-${process.env.E2E_MODE}-375.png`,
		fullPage: true,
	});
});

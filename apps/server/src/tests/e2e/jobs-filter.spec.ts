import { randomUUID } from "node:crypto";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { E2E_PROCESSING_JOB_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("finds an older failed batch and requests its retry after pagination, SPA navigation and F5", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	const failed = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	expect(failed.status).toBe("failed");
	const requests: Array<{ status?: string; offset?: number }> = [];
	let retriedId: string | undefined;
	// Keep the shared persisted failure fixture intact for the other browser
	// scenarios. Actual retry persistence and pending recovery are covered by
	// job-parent-retry.test.ts and batch-runs.test.ts against isolated databases.
	await page.route(/\/api\/rpc\/jobs\/retry(?:\?|$)/, async (route) => {
		const envelope = JSON.parse(route.request().postData() ?? "{}");
		retriedId = envelope.json?.id;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				json: { ...failed, status: "pending", canRetry: false },
			}),
		});
	});
	await page.route(/\/api\/rpc\/jobs\/list(?:\?|$)/, async (route) => {
		const request = route.request();
		const encoded = new URL(request.url()).searchParams.get("data");
		const envelope = JSON.parse(encoded ?? request.postData() ?? "{}");
		const input = envelope.json ?? {};
		requests.push(input);
		if (input.status) {
			await route.continue();
			return;
		}
		// Represent the newer pending pages that bury the real persisted parent.
		// Filtered reads and Retry still use the actual isolated server/database.
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				json: {
					items: Array.from({ length: 200 }, () => ({
						...failed,
						id: randomUUID(),
						type: "extract_ccip_vector",
						status: "pending",
						canRetry: false,
						canCancel: false,
						targetMediaId: null,
						progress: null,
					})),
					total: 401,
				},
			}),
		});
	});
	const selectFailed = async () => {
		await page.getByRole("tab", { name: /^Failed / }).click();
		const parent = page.getByRole("button", {
			name: new RegExp("job " + failed.id.slice(0, 8) + "$"),
		});
		await expect(parent).toBeVisible();
		expect(
			requests.some((input) => input.status === "failed" && input.offset === 0),
		).toBe(true);
		await expect(
			page.getByText("Failed jobsはありません", { exact: true }),
		).toHaveCount(0);
		return parent;
	};
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page.getByRole("button", { name: "Next page", exact: true }).click();
	await expect
		.poll(() => requests.some((input) => input.offset === 200))
		.toBe(true);
	await selectFailed();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	await selectFailed();
	await page.reload();
	await waitForAppHydration(page);
	await (await selectFailed()).click();
	await page
		.getByRole("button", { name: "Retry job", exact: true })
		.filter({ visible: true })
		.click();
	await expect.poll(() => retriedId).toBe(failed.id);
	await expect(
		page.getByText("Job queued for retry", { exact: true }),
	).toBeVisible();
});

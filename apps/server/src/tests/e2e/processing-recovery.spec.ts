import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { E2E_PROCESSING_JOB_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("reloads failed processing steps and retries only the unfinished step", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const selectJob = () =>
		page
			.getByRole("button", {
				name: new RegExp(`job ${E2E_PROCESSING_JOB_ID.slice(0, 8)}$`),
			})
			.click();
	await selectJob();
	const steps = page
		.getByRole("region", { name: "Processing steps" })
		.filter({ visible: true });
	await expect(steps).toContainText("ThumbnailsFailed");
	await expect(steps).toContainText("MetadataCompleted");
	await page.reload();
	await waitForAppHydration(page);
	await selectJob();
	await expect(steps).toContainText("ThumbnailsFailed");
	await page
		.getByRole("button", { name: "Retry job", exact: true })
		.filter({ visible: true })
		.click();
	await expect(steps).toContainText("ThumbnailsCompleted", { timeout: 30_000 });
	const completed = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	expect(completed.processingSteps).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "metadata",
				status: "completed",
				attemptCount: 1,
			}),
			expect.objectContaining({
				kind: "thumbnail",
				status: "completed",
				attemptCount: 2,
			}),
		]),
	);
	expect(completed).not.toHaveProperty("processingCheckpoint");
	expect(completed).not.toHaveProperty("payload");
	// SPA navigation also loads the persisted completed checkpoint.
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	await selectJob();
	await expect(steps).toContainText("ThumbnailsCompleted");
});

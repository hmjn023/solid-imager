import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { ccipFeatureResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import {
	E2E_PROCESSING_JOB_ID,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./support/fixture";
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
	const current = page
		.getByRole("region", { name: "Current media processing" })
		.filter({ visible: true });
	await expect(current).toContainText("MetadataCompleted");
	await expect(current).toContainText("ThumbnailsFailed");
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
	expect(completed.currentProcessingSteps).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "metadata",
				status: "completed",
				attemptCount: 1,
			}),
			expect.objectContaining({
				kind: "thumbnail",
				status: "completed",
				// The dedicated request counts its own attempts; legacy checkpoint retains its history.
				attemptCount: 1,
			}),
		]),
	);
	for (const step of completed.currentProcessingSteps ?? []) {
		expect(Object.keys(step).sort()).toEqual([
			"attemptCount",
			"kind",
			"status",
			"updatedAt",
		]);
	}
	expect(completed).not.toHaveProperty("processingCheckpoint");
	expect(completed).not.toHaveProperty("payload");
	await expect(current).toContainText("ThumbnailsCompleted");
	await page.reload();
	await waitForAppHydration(page);
	await selectJob();
	await expect(current).toContainText("ThumbnailsCompleted");
	// SPA navigation also loads the persisted completed checkpoint.
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	await selectJob();
	await expect(steps).toContainText("ThumbnailsCompleted");
});

test("reuses real tagging and CCIP results and restores current AI state after reload", async ({
	page,
	baseURL,
}) => {
	test.setTimeout(120_000);
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: `${baseURL}/api/rpc` }),
	);
	const result = await client.ai.tag({
		mediaSourceId: E2E_SOURCE_ID,
		mediaId: E2E_PRIMARY_MEDIA_ID,
	});
	const before = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	const tagging = before.currentProcessingSteps?.find(
		(step) => step.kind === "tagging",
	);
	expect(tagging).toMatchObject({ status: "completed" });
	expect(
		await client.ai.tag({
			mediaSourceId: E2E_SOURCE_ID,
			mediaId: E2E_PRIMARY_MEDIA_ID,
		}),
	).toEqual(result);
	const after = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	expect(
		after.currentProcessingSteps?.find((step) => step.kind === "tagging"),
	).toEqual(tagging);
	const ccipResult = ccipFeatureResponseSchema.parse(
		await client.ai.ccipFeature({
			mediaSourceId: E2E_SOURCE_ID,
			mediaId: E2E_PRIMARY_MEDIA_ID,
		}),
	);
	const ccipBefore = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	const ccip = ccipBefore.currentProcessingSteps?.find(
		(step) => step.kind === "ccip",
	);
	expect(ccip).toMatchObject({ status: "completed" });
	const cachedCcipResult = ccipFeatureResponseSchema.parse(
		await client.ai.ccipFeature({
			mediaSourceId: E2E_SOURCE_ID,
			mediaId: E2E_PRIMARY_MEDIA_ID,
		}),
	);
	// pgvector stores float32 values and can serialize them with fewer decimal
	// digits than native inference. Compare the stored precision exactly.
	expect(Array.from(new Float32Array(cachedCcipResult.feature))).toEqual(
		Array.from(new Float32Array(ccipResult.feature)),
	);
	const ccipAfter = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	expect(ccipAfter.currentProcessingSteps).toEqual(
		ccipBefore.currentProcessingSteps,
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
	const current = page
		.getByRole("region", { name: "Current media processing" })
		.filter({ visible: true });
	await expect(current).toContainText("AI taggingCompleted");
	await expect(current).toContainText("Full-image CCIPCompleted");
	await page.reload();
	await waitForAppHydration(page);
	await selectJob();
	await expect(current).toContainText("AI taggingCompleted");
	await expect(current).toContainText("Full-image CCIPCompleted");
});

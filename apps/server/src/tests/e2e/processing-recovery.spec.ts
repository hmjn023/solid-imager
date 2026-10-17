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

test("reloads a failed batch and retries only its unfinished thumbnail", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const select = () =>
		page
			.getByRole("button", {
				name: new RegExp("job " + E2E_PROCESSING_JOB_ID.slice(0, 8) + "$"),
			})
			.click();
	await select();
	const current = () =>
		page
			.getByRole("region", { name: "Current media processing" })
			.filter({ visible: true });
	await expect(current()).toContainText("MetadataCompleted");
	await expect(current()).toContainText("ThumbnailsFailed");
	const before = await client.batches.items({
		id: E2E_PROCESSING_JOB_ID,
		limit: 25,
		offset: 0,
	});
	expect(before.items[0]).toMatchObject({
		kind: "thumbnail",
		status: "failed",
		attemptCount: 1,
	});
	await page.reload();
	await waitForAppHydration(page);
	await select();
	await page
		.getByRole("button", { name: "Retry job", exact: true })
		.filter({ visible: true })
		.click();
	await expect(current()).toContainText("ThumbnailsCompleted", {
		timeout: 30000,
	});
	const completed = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
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
				attemptCount: 1,
			}),
		]),
	);
	const after = await client.batches.items({
		id: E2E_PROCESSING_JOB_ID,
		limit: 25,
		offset: 0,
	});
	expect(after.items[0]).toMatchObject({
		id: before.items[0].id,
		status: "completed",
		attemptCount: 2,
	});
	expect(
		(
			await client.batches.attempts({
				id: after.items[0].id,
				limit: 25,
				offset: 0,
			})
		).items.map((attempt) => attempt.status),
	).toEqual(["completed", "failed"]);
	expect(completed).not.toHaveProperty("payload");
	await page.reload();
	await waitForAppHydration(page);
	await select();
	await expect(current()).toContainText("ThumbnailsCompleted");
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	await select();
	await expect(current()).toContainText("ThumbnailsCompleted");
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

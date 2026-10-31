import { randomUUID } from "node:crypto";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { E2E_SOURCE_ID, E2E_SOURCE_NAME } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

for (const kind of ["embedding", "ccip", "tagging", "thumbnails"] as const) {
	test(`restores ${kind} batch progress after navigation and reload`, async ({
		page,
		browserHealth,
	}, testInfo) => {
		browserHealth.allowRequestFailure(/\/api\/rpc\/jobs\/events(?:\?|$)/);
		const jobId = randomUUID();
		let releaseReconnect: () => void = () => {};
		const reconnectGate = new Promise<void>((resolve) => {
			releaseReconnect = resolve;
		});
		let streamAttempts = 0;
		if (kind === "embedding") {
			await page.route(/\/api\/rpc\/jobs\/events(?:\?|$)/, async (route) => {
				streamAttempts++;
				if (streamAttempts === 2) await reconnectGate;
				if (streamAttempts <= 2) {
					await route.fulfill({
						status: 200,
						contentType: "text/event-stream",
						body: "",
					});
				} else await route.continue();
			});
		}
		const job: JobDto = {
			id: jobId,
			type:
				kind === "embedding"
					? "extract_embedding_batch"
					: kind === "ccip"
						? "batch_ccip_parent"
						: kind === "tagging"
							? "bulk_tagging_parent"
							: "thumbnail_generation_parent",
			mediaSourceId: E2E_SOURCE_ID,
			status: "in_progress",
			progress: { processed: 1, failed: 0, total: 4 },
			createdAt: new Date(),
			updatedAt: new Date(),
			parentId: null,
			error: null,
			cancelRequestedAt: null,
			cancelledAt: null,
			attemptCount: 1,
			startedAt: new Date(),
			finishedAt: null,
			targetMediaId: null,
			targetMediaModifiedAt: null,
			artifact: null,
		};
		const endpoint =
			kind === "embedding"
				? "ai/startBatchEmbeddingExtraction"
				: kind === "ccip"
					? "ai/startBatchCcipExtraction"
					: kind === "tagging"
						? "ai/startBatchTagging"
						: "thumbnails/generate";
		// Deterministic job snapshots isolate UI recovery and geometry from AI timing.
		await page.route(`**/api/rpc/${endpoint}`, (route) =>
			route.fulfill({
				json: { json: { success: true, jobId, message: "Batch queued" } },
			}),
		);
		await page.route(/\/api\/rpc\/jobs\/get(?:\?|$)/, (route) =>
			route.fulfill({ json: { json: job } }),
		);
		await page.goto("/manager");
		await waitForAppHydration(page);
		const category =
			kind === "tagging"
				? "Batch tagging"
				: kind === "thumbnails"
					? "Thumbnails"
					: "Vector extraction";
		await page
			.getByRole("button", { name: new RegExp(`^${category}`) })
			.filter({ visible: true })
			.click();
		if (kind === "ccip") {
			await page.getByRole("button", { name: "Embedding model" }).click();
			await page.getByRole("option", { name: "CCIP", exact: true }).click();
		}
		await page
			.getByRole("button", {
				name: kind === "thumbnails" ? "Select source" : "All sources",
				exact: true,
			})
			.click();
		await page
			.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
			.click();
		const start = page.getByRole("button", {
			name:
				kind === "tagging"
					? "Start tagging"
					: kind === "thumbnails"
						? "Warm missing thumbnails"
						: "Start extraction",
			exact: true,
		});
		await start.click();
		const bar = page.getByRole("progressbar", { name: "Batch progress" });
		await expect(bar).toHaveAttribute("aria-valuenow", "25");
		await expect
			.poll(() =>
				bar.evaluate((element) => {
					const track = element.firstElementChild;
					const fill = track?.firstElementChild;
					return track && fill
						? fill.getBoundingClientRect().width /
								track.getBoundingClientRect().width
						: -1;
				}),
			)
			.toBeCloseTo(0.25, 1);
		if (kind === "embedding") {
			job.progress = { processed: 2, failed: 0, total: 4 };
			releaseReconnect();
			await expect(bar).toHaveAttribute("aria-valuenow", "50");
		}
		const mobile = testInfo.project.name === "responsive-375";
		if (mobile) await page.goto("/search");
		else
			await page
				.getByRole("link", { name: "Library", exact: true })
				.filter({ visible: true })
				.click();
		job.progress = { processed: 3, failed: 0, total: 4 };
		if (mobile) await page.goto("/manager");
		else
			await page
				.getByRole("link", { name: "Manager", exact: true })
				.filter({ visible: true })
				.click();
		await expect(bar).toHaveAttribute("aria-valuenow", "75");
		await expect(start).toBeDisabled();
		await expect(
			page.getByRole("button", { name: E2E_SOURCE_NAME, exact: true }),
		).toBeVisible();
		await page.reload();
		await expect(bar).toHaveAttribute("aria-valuenow", "75");
		await page.screenshot({
			path: testInfo.outputPath("restored-batch-progress.png"),
			animations: "disabled",
		});
		await page.goto("/jobs");
		job.status =
			kind === "ccip"
				? "failed"
				: kind === "thumbnails"
					? "cancelled"
					: "completed";
		job.error = kind === "ccip" ? "One extraction failed" : null;
		job.progress =
			kind === "ccip"
				? { processed: 3, failed: 1, total: 4 }
				: kind === "thumbnails"
					? { processed: 3, failed: 0, total: 4 }
					: { processed: 4, failed: 0, total: 4 };
		await page.goto("/manager");
		await expect(bar).toHaveAttribute(
			"aria-valuenow",
			kind === "thumbnails" ? "75" : "100",
		);
		await expect(
			page.getByText(
				kind === "ccip"
					? "Job failed: One extraction failed"
					: kind === "thumbnails"
						? "Batch operation cancelled."
						: "Batch operation completed successfully.",
				{
					exact: true,
				},
			),
		).toBeVisible();
		await expect(start).toBeEnabled();
	});
}

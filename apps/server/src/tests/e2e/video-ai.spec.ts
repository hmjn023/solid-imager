import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { AppConfigSchema } from "@solid-imager/core/config";
import { jobStatusSchema } from "@solid-imager/core/jobs";
import { mediaSearchResponseSchema } from "@solid-imager/core/media";
import {
	startCcipExtractionResponseSchema,
	taggingResponseSchema,
} from "@solid-imager/core/tagging";
import ffmpegPath from "ffmpeg-static";
import { z } from "zod";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const jobResultSchema = z.object({
	status: jobStatusSchema,
	type: z.string(),
	error: z.string().nullable(),
});

test("indexes real video thumbnails for tags, character similarity and semantic search", async ({
	page,
	browserHealth,
}, testInfo) => {
	test.setTimeout(240_000);
	browserHealth.allowRequestFailure(/\/api\/rpc\/jobs\/events(?:\?|$)/);
	const rpc = async (
		endpoint: string,
		input: object,
		timeout = 30_000,
	): Promise<unknown> => {
		const response = await page.request.post(`/api/rpc/${endpoint}`, {
			data: { json: input },
			timeout,
		});
		expect(
			response.ok(),
			`${endpoint}: ${response.status()} ${response.ok() ? "" : await response.text()}`,
		).toBe(true);
		return z.object({ json: z.unknown() }).parse(await response.json()).json;
	};
	const waitForJob = async (jobId: string, expectedType: string) => {
		await expect
			.poll(
				async () => {
					const job = jobResultSchema.parse(
						await rpc("jobs/get", { id: jobId }),
					);
					expect(job.type).toBe(expectedType);
					return job.status;
				},
				{ timeout: 120_000 },
			)
			.toMatch(/^(completed|failed|cancelled)$/);
		const job = jobResultSchema.parse(await rpc("jobs/get", { id: jobId }));
		expect(job.status, job.error ?? `${expectedType} did not complete`).toBe(
			"completed",
		);
	};
	const config = AppConfigSchema.parse(await rpc("config/get", {}));
	const sourceId = randomUUID();
	const directory = path.join(getE2eRuntimeDir(), sourceId);
	const videoName = "video-ai-fixture.webm";
	let sourceCreated = false;
	try {
		await rpc("config/update", {
			ai: { ...config.ai, provider: "cpu", device: "" },
		});
		await mkdir(directory);
		await copyFile(
			getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
			path.join(directory, E2E_PRIMARY_FILE_NAME),
		);
		if (!ffmpegPath)
			throw new Error("FFmpeg is required for the isolated video AI fixture");
		// Both media show the same image, so either can be the similarity anchor.
		execFileSync(ffmpegPath, [
			"-hide_banner",
			"-loglevel",
			"error",
			"-loop",
			"1",
			"-i",
			getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
			"-t",
			"2",
			"-r",
			"5",
			"-c:v",
			"libvpx-vp9",
			"-lossless",
			"1",
			"-an",
			path.join(directory, videoName),
		]);
		await rpc("sources/create", {
			id: sourceId,
			name: `Video AI test ${sourceId}`,
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		sourceCreated = true;
		await rpc("sources/sync", { ids: [sourceId] });
		let imageId = "";
		let videoId = "";
		await expect
			.poll(async () => {
				const result = mediaSearchResponseSchema.parse(
					await rpc("media/search", {
						sourceId,
						params: { limit: 20, offset: 0 },
					}),
				);
				imageId =
					result.media.find((item) => item.fileName === E2E_PRIMARY_FILE_NAME)
						?.id ?? "";
				videoId =
					result.media.find(
						(item) => item.fileName === videoName && item.mediaType === "video",
					)?.id ?? "";
				return Boolean(imageId && videoId);
			})
			.toBe(true);

		const tags = taggingResponseSchema.parse(
			await rpc(
				"ai/tag",
				{
					mediaSourceId: sourceId,
					mediaId: videoId,
				},
				120_000,
			),
		);
		const savedTags = z.array(z.object({ name: z.string() })).parse(
			await rpc("media/getTags", {
				sourceId,
				mediaId: videoId,
			}),
		);
		const inferredNames = Object.keys(tags.general);
		expect(inferredNames.length).toBeGreaterThan(0);
		expect(savedTags.map((tag) => tag.name)).toEqual(
			expect.arrayContaining(inferredNames),
		);
		const tagged = mediaSearchResponseSchema.parse(
			await rpc("media/search", {
				sourceId,
				params: {
					condition: {
						type: "group",
						operator: "and",
						children: [
							{
								type: "criterion",
								target: "tag",
								operator: "equals",
								value: inferredNames[0],
							},
						],
					},
					limit: 20,
					offset: 0,
				},
			}),
		);
		expect(tagged.media.map((item) => item.id)).toContain(videoId);
		await testInfo.attach("video-inferred-tags", {
			body: JSON.stringify(tags),
			contentType: "application/json",
		});

		for (const [endpoint, jobType] of [
			["ai/startCcipExtraction", "extract_ccip_vector"],
			["ai/startEmbeddingExtraction", "extract_embedding_vector"],
		] as const) {
			for (const mediaId of [imageId, videoId]) {
				const queued = startCcipExtractionResponseSchema.parse(
					await rpc(endpoint, {
						mediaSourceId: sourceId,
						mediaId,
						force: true,
					}),
				);
				await waitForJob(queued.jobId, jobType);
			}
		}
		for (const model of ["ccip", "embeddinggemma2"]) {
			for (const [anchorMediaId, candidateId] of [
				[imageId, videoId],
				[videoId, imageId],
			]) {
				const similar = mediaSearchResponseSchema.parse(
					await rpc("media/searchSimilar", {
						model,
						anchorMediaId,
						mediaSourceId: sourceId,
						topK: 10,
						limit: 10,
						offset: 0,
					}),
				);
				expect(similar.media.map((item) => item.id)).toContain(candidateId);
				expect(similar.media.map((item) => item.id)).not.toContain(
					anchorMediaId,
				);
			}
		}
		const semantic = mediaSearchResponseSchema.parse(
			await rpc(
				"media/searchSemantic",
				{
					text: "a purple circle with white mountains",
					mediaSourceId: sourceId,
					topK: 10,
					limit: 10,
					offset: 0,
				},
				120_000,
			),
		);
		expect(semantic.media.map((item) => item.id)).toEqual(
			expect.arrayContaining([imageId, videoId]),
		);

		await page.goto(`/sources/${sourceId}/${videoId}`);
		await waitForAppHydration(page);
		await expect(page.locator("media-controller video")).toHaveJSProperty(
			"controls",
			false,
		);
		await expect(
			page.getByText("AI analyzes this video's representative thumbnail."),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Find similar", exact: true }),
		).toBeEnabled();
		await page.reload();
		await waitForAppHydration(page);
		await expect(page.locator("media-controller video")).toHaveJSProperty(
			"controls",
			false,
		);
		await page
			.getByRole("button", { name: "More actions", exact: true })
			.click();
		await expect(
			page.getByRole("button", {
				name: "Extract EmbeddingGemma 2 vector",
				exact: true,
			}),
		).toBeVisible();
		await page
			.getByRole("button", {
				name: "Find similar (EmbeddingGemma 2)",
				exact: true,
			})
			.click();
		await expect(page).toHaveURL(/\/search/);
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: new RegExp(videoName) }),
		).toHaveCount(0);
	} finally {
		await page.goto("about:blank");
		try {
			if (sourceCreated) await rpc("sources/delete", { id: sourceId });
		} finally {
			await rm(directory, { recursive: true, force: true });
			await rpc("config/update", { ai: config.ai });
		}
	}
});

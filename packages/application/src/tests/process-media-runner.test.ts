import type { Media } from "@solid-imager/core/domain/media/schemas";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ProcessMediaBatchRunnerDeps } from "../services/process-media-runner";
import { runProcessMediaBatchJobs } from "../services/process-media-runner";

const now = new Date("2026-04-26T00:00:00.000Z");

function makeMedia(overrides: Partial<Media> = {}): Media {
	return {
		id: "00000000-0000-4000-8000-000000000001",
		mediaSourceId: "00000000-0000-4000-8000-000000000010",
		filePath: "image.png",
		fileName: "image.png",
		mediaType: "image",
		width: 128,
		height: 128,
		fileSize: 1024,
		description: null,
		createdAt: now,
		modifiedAt: now,
		indexedAt: now,
		status: "active",
		...overrides,
	};
}

function makeDeps(media: Media | null = makeMedia()): ProcessMediaBatchRunnerDeps {
	return {
		mediaRepository: {
			findById: vi.fn(async () => media),
			upsertGenerationInfo: vi.fn(async (mediaId, prompt, workflow) => ({
				mediaId,
				metadata: null,
				prompt,
				negativePrompt: null,
				workflow,
				loras: null,
				vae: null,
				hypernetworks: null,
				embeddings: null,
				aiGenerated: true,
				modelName: "",
				seed: 0,
				cfgScale: 0,
				steps: 0,
			})),
		},
		tagRepository: {
			addTagsToMedia: vi.fn(async () => undefined),
		},
		pathJoin: vi.fn((basePath: string, filePath: string) => {
			return `${basePath}/${filePath}`;
		}),
		extractMetadata: vi.fn(async () => ({
			prompt: { prompt: "hello" },
			workflow: { nodes: [] },
			tags: [{ name: "tag", type: "positive" as const }],
		})),
		generateThumbnails: vi.fn(async () => undefined),
		emitThumbnailGenerated: vi.fn(async () => undefined),
		queueAutoTagging: vi.fn(async () => undefined),
		isAutoTaggingEnabled: vi.fn(async () => true),
		logger: {
			error: vi.fn(),
			warn: vi.fn(),
		},
	};
}

function makeJob(
	overrides: {
		id?: string;
		mediaSourceId?: string | null;
		payload?: unknown;
	} = {},
) {
	return {
		id: overrides.id ?? "job-1",
		mediaSourceId: overrides.mediaSourceId ?? "source-1",
		payload: overrides.payload ?? {
			mediaId: "00000000-0000-4000-8000-000000000001",
			sourcePath: "/source",
			type: "processMedia",
		},
	};
}

describe("process-media-runner", () => {
	it("runs valid batch jobs through metadata, thumbnail, event, and auto-tagging", async () => {
		const calls: string[] = [];
		const deps = makeDeps();
		deps.extractMetadata = vi.fn(async () => {
			calls.push("metadata");
			return { prompt: "prompt", workflow: null, tags: [] };
		});
		deps.generateThumbnails = vi.fn(async () => {
			calls.push("thumbnail");
		});
		deps.emitThumbnailGenerated = vi.fn(async () => {
			calls.push("event");
		});
		deps.queueAutoTagging = vi.fn(async () => {
			calls.push("autoTagging");
		});

		const results = await runProcessMediaBatchJobs([makeJob()], deps);

		expect(results).toEqual([{ jobId: "job-1", mediaSourceId: "source-1", status: "completed" }]);
		expect(calls).toEqual(["metadata", "thumbnail", "event", "autoTagging"]);
		expect(deps.mediaRepository.upsertGenerationInfo).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000001",
			"prompt",
			null,
		);
	});

	it("treats invalid payloads as completed skips", async () => {
		const deps = makeDeps();

		const results = await runProcessMediaBatchJobs(
			[makeJob({ payload: { mediaId: "media-id" } })],
			deps,
		);

		expect(results).toEqual([{ jobId: "job-1", mediaSourceId: "source-1", status: "completed" }]);
		expect(deps.mediaRepository.findById).not.toHaveBeenCalled();
		expect(deps.generateThumbnails).not.toHaveBeenCalled();
	});

	it("treats missing media as a completed skip", async () => {
		const deps = makeDeps(null);

		const results = await runProcessMediaBatchJobs([makeJob()], deps);

		expect(results).toEqual([{ jobId: "job-1", mediaSourceId: "source-1", status: "completed" }]);
		expect(deps.generateThumbnails).not.toHaveBeenCalled();
	});

	it("continues when metadata extraction fails", async () => {
		const deps = makeDeps();
		deps.extractMetadata = vi.fn(async () => {
			throw new Error("metadata failed");
		});

		const results = await runProcessMediaBatchJobs([makeJob()], deps);

		expect(results).toEqual([{ jobId: "job-1", mediaSourceId: "source-1", status: "completed" }]);
		expect(deps.generateThumbnails).toHaveBeenCalled();
		expect(deps.queueAutoTagging).toHaveBeenCalled();
	});

	it("continues when thumbnail generation fails", async () => {
		const deps = makeDeps();
		deps.generateThumbnails = vi.fn(async () => {
			throw new Error("thumbnail failed");
		});

		const results = await runProcessMediaBatchJobs([makeJob()], deps);

		expect(results).toEqual([{ jobId: "job-1", mediaSourceId: "source-1", status: "completed" }]);
		expect(deps.queueAutoTagging).toHaveBeenCalledWith({
			mediaId: "00000000-0000-4000-8000-000000000001",
			mediaSourceId: "source-1",
		});
	});

	it("queues auto-tagging only for images when enabled", async () => {
		const deps = makeDeps(makeMedia({ mediaType: "video" }));

		await runProcessMediaBatchJobs([makeJob()], deps);

		expect(deps.queueAutoTagging).not.toHaveBeenCalled();
	});

	it("honors custom processing steps", async () => {
		const deps = makeDeps();

		await runProcessMediaBatchJobs(
			[
				makeJob({
					payload: {
						mediaId: "00000000-0000-4000-8000-000000000001",
						sourcePath: "/source",
						steps: ["generateThumbnail"],
						type: "processMedia",
					},
				}),
			],
			deps,
		);

		expect(deps.extractMetadata).not.toHaveBeenCalled();
		expect(deps.generateThumbnails).toHaveBeenCalled();
		expect(deps.queueAutoTagging).not.toHaveBeenCalled();
	});
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processDownloadJob } from "~/infrastructure/jobs/download-jobs";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import {
	JobRepository,
	MediaRepository,
} from "~/infrastructure/db/repositories";

// Hoisted mocks
// Hoisted mocks
const {
	mockFindById,
	mockGetFileMetadata,
	mockMediaRegisterAndProcess,
	mockMediaAddContextMetadata,
	mockMediaCreate,
	mockMediaUpdate,
	mockMediaAddUrls,
	mockMediaFindByPath,
	mockAuthorCreate,
	mockAuthorAddMedia,
	mockSaveFile,
	mockDownloadUgoiraArchive,
	mockConvertUgoiraToMp4,
} = vi.hoisted(() => ({
	mockFindById: vi.fn(),
	mockGetFileMetadata: vi.fn(),
	mockMediaRegisterAndProcess: vi.fn(),
	mockMediaAddContextMetadata: vi.fn(),
	mockMediaCreate: vi.fn(),
	mockMediaUpdate: vi.fn(),
	mockMediaAddUrls: vi.fn(),
	mockMediaFindByPath: vi.fn(),
	mockAuthorCreate: vi.fn(),
	mockAuthorAddMedia: vi.fn(),
	mockSaveFile: vi.fn(),
	mockDownloadUgoiraArchive: vi.fn(),
	mockConvertUgoiraToMp4: vi.fn(),
}));

// Mocks
vi.mock("~/infrastructure/services/ugoira-download", () => ({
	downloadUgoiraArchive: mockDownloadUgoiraArchive,
}));
vi.mock("~/infrastructure/services/ugoira-converter", () => ({
	convertUgoiraToMp4: mockConvertUgoiraToMp4,
}));
vi.mock("~/infrastructure/jobs/download-rate-limiter", () => ({
	waitForDownloadRateLimit: vi.fn(),
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/infrastructure/db/repositories", () => ({
	JobRepository: { update: vi.fn(), isCancellationRequested: vi.fn() },
	DrizzleSourceRepository: {
		findById: mockFindById,
	},
	MediaRepository: {
		create: mockMediaCreate,
		update: mockMediaUpdate,
		addUrls: mockMediaAddUrls,
		findByPath: mockMediaFindByPath,
	},
	AuthorRepository: {
		create: mockAuthorCreate,
		addMedia: mockAuthorAddMedia,
	},
}));

vi.mock("~/infrastructure/storage/server-media-storage", () => ({
	ServerMediaStorage: {
		getFileMetadata: mockGetFileMetadata,
		saveFile: mockSaveFile,
	},
}));
// job-manager mock removed
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: {
		publishSource: vi.fn(),
	},
}));
vi.mock("~/infrastructure/services/media-processing-service", () => ({
	MediaProcessingService: {
		registerAndProcess: mockMediaRegisterAndProcess,
		addContextMetadataToExistingMedia: mockMediaAddContextMetadata,
	},
}));
vi.mock("node:fs/promises", () => ({
	default: {
		mkdir: vi.fn(),
		stat: vi.fn(),
		writeFile: vi.fn(),
		unlink: vi.fn(),
		access: vi.fn(),
		rename: vi.fn(),
		mkdtemp: vi.fn(),
		link: vi.fn(),
		rm: vi.fn(),
	},
}));
vi.mock("node:child_process", () => ({
	execFile: vi.fn((_cmd, _args, _opts, cb) =>
		cb(null, { stdout: "", stderr: "" }),
	),
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock as any;

// Unified format: {author}_{platform}_{postId}_{assetId}.{ext}
const TWITTER_POST_URL = "https://x.com/user/status/123";
const VXTWITTER_API_URL = "https://api.vxtwitter.com/i/status/123";
const POST_DATE = new Date("2026-09-30T14:32:00Z");

function mockTwitterPost(
	media: { type: string; url: string }[],
	text = "Post text",
) {
	fetchMock.mockResolvedValueOnce(
		Response.json({
			tweetID: "123",
			text,
			date_epoch: POST_DATE.getTime() / 1000,
			media_extended: media,
		}),
	);
}

const DOWNLOAD_FILENAME_PATTERN = /^user_twitter_123_image\.jpg$/;

describe("processDownloadJob", () => {
	beforeEach(async () => {
		vi.resetAllMocks();
		vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
		vi.mocked(fs.mkdtemp).mockResolvedValue(
			"/tmp/downloads/.xtracter-ugoira-fixture",
		);
		fetchMock.mockResolvedValue({
			ok: true,
			headers: new Headers({ "content-type": "image/jpeg" }),
			arrayBuffer: async () => new ArrayBuffer(10),
		});

		// Default mocks
		mockFindById.mockResolvedValue({
			id: "source-1",
			name: "Local Source",
			type: "local",
			connectionInfo: { path: "/tmp/downloads" },
			createdAt: new Date(),
			updatedAt: new Date(),
			description: null,
		});

		mockConvertUgoiraToMp4.mockResolvedValue({ width: 800, height: 600 });
		vi.mocked(fs.stat).mockResolvedValue({
			size: 1000,
			birthtime: new Date(),
			mtime: new Date(),
		} as Awaited<ReturnType<typeof fs.stat>>);
		mockGetFileMetadata.mockResolvedValue({
			size: 1000,
			createdAt: new Date(),
			modifiedAt: new Date(),
			width: 800,
			height: 600,
		});

		mockSaveFile.mockImplementation((_base, _file, options) => {
			const filename = options?.filename || "file.jpg";
			return Promise.resolve({
				filePath: filename,
				fileName: filename,
				width: 800,
				height: 600,
				size: 1000,
				createdAt: new Date(),
				modifiedAt: new Date(),
			});
		});

		mockMediaRegisterAndProcess.mockResolvedValue({
			id: "media-1",
			mediaSourceId: "source-1",
			filePath: "file.jpg",
			fileName: "file.jpg",
			mediaType: "image",
			width: 800,
			height: 600,
			fileSize: 1000,
			description: null,
			createdAt: new Date(),
			modifiedAt: new Date(),
			indexedAt: new Date(),
			status: "active",
		});

		mockMediaCreate.mockResolvedValue({
			id: "media-1",
			mediaSourceId: "source-1",
			filePath: "file.jpg",
			fileName: "file.jpg",
			mediaType: "image",
			width: 800,
			height: 600,
			fileSize: 1000,
			description: null,
			createdAt: new Date(),
			modifiedAt: new Date(),
			indexedAt: new Date(),
			status: "active",
		});

		mockAuthorCreate.mockResolvedValue({
			id: "author-1",
			name: "Author",
			accountId: "@author",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const { services } = await import("~/infrastructure/service-registry");
		services.getJobRepository = vi.fn().mockReturnValue({
			create: vi.fn(),
		});
	});

	it("rejects an HTML response even when the vxTwitter API returns HTTP 200", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		const job = {
			id: "job-vx-error",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: TWITTER_POST_URL },
		} as any;

		await expect(processDownloadJob(job)).rejects.toThrow(
			"vxTwitter returned a non-JSON response",
		);
		expect(RealtimeEventBus.publishSource).toHaveBeenCalledWith(
			"source-1",
			"download-error",
			{
				url: TWITTER_POST_URL,
				error: "vxTwitter returned a non-JSON response",
			},
		);
		expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
	});

	it("downloads the GIF from a mixed X post and keeps its original post metadata", async () => {
		const image = "https://pbs.twimg.com/media/photo.jpg";
		const video = "https://video.twimg.com/ext_tw_video/sample.mp4";
		mockTwitterPost([
			{ type: "image", url: image },
			{ type: "gif", url: video },
		]);
		fetchMock.mockResolvedValueOnce(
			new Response("video", { headers: { "content-type": "video/mp4" } }),
		);
		const job = {
			id: "job-vx-mixed",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: TWITTER_POST_URL,
				cookies: [
					{
						domain: ".x.com",
						path: "/",
						secure: true,
						name: "auth_token",
						value: "private",
					},
				],
			},
		} as any;

		await processDownloadJob(job);
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			VXTWITTER_API_URL,
			video,
		]);
		for (const [, init] of fetchMock.mock.calls) {
			expect(init.redirect).toBe("error");
			expect(new Headers(init.headers).has("cookie")).toBe(false);
		}
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledOnce();
		expect(mockMediaRegisterAndProcess).toHaveBeenLastCalledWith(
			"source-1",
			expect.stringMatching(/\.mp4$/),
			expect.objectContaining({
				description: "Post text",
				createdAt: POST_DATE,
				sourceUrls: [TWITTER_POST_URL],
			}),
		);
	});

	it("downloads only the requested attachment from an indexed X video URL", async () => {
		const selected = "https://video.twimg.com/selected.mp4";
		mockTwitterPost([
			{ type: "image", url: "https://pbs.twimg.com/media/photo.jpg" },
			{ type: "video", url: selected },
			{ type: "video", url: "https://video.twimg.com/other.mp4" },
		]);
		fetchMock.mockResolvedValueOnce(
			new Response("video", {
				headers: { "content-type": "video/mp4" },
			}),
		);

		await processDownloadJob({
			id: "job-vx-indexed",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: `${TWITTER_POST_URL}/video/2` },
		} as any);

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			VXTWITTER_API_URL,
			selected,
		]);
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledOnce();
	});

	it("resumes a pre-upgrade checkpoint without downloading the post again", async () => {
		const parentId = crypto.randomUUID();
		await processDownloadJob({
			id: crypto.randomUUID(),
			parentId,
			attemptCount: 2,
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: TWITTER_POST_URL,
				importBatchId: crypto.randomUUID(),
				importTargetId: parentId,
				downloadOutputs: [
					{
						filePath: "/tmp/downloads/staged.mp4",
						targetPath: "/tmp/downloads/final.mp4",
						metadata: {
							id: "123",
							title: "Legacy video",
							description: "",
							ext: "mp4",
							filename: "staged.mp4",
							upload_date: "20260930",
						},
					},
				],
				nextOutput: 0,
			},
		} as any);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			"final.mp4",
			expect.objectContaining({
				description: "Legacy video",
				createdAt: new Date("2026-09-30"),
			}),
			expect.objectContaining({ attempt: 2 }),
		);
	});

	it("rejects video URLs outside the X media CDN", async () => {
		mockTwitterPost([
			{ type: "video", url: "https://video.twimg.com.example.com/video.mp4" },
		]);
		await expect(
			processDownloadJob({
				id: "job-vx-untrusted",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: { targetUrl: TWITTER_POST_URL },
			} as any),
		).rejects.toThrow("vxTwitter returned no downloadable MP4");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("resumes a grouped multi-file download at the unpublished output", async () => {
		const parentId = crypto.randomUUID();
		const job = {
			id: crypto.randomUUID(),
			parentId,
			type: "downloadImage",
			mediaSourceId: "source-1",
			payload: {
				targetUrl: "https://x.com/user/status/123",
				importBatchId: crypto.randomUUID(),
				importTargetId: parentId,
			},
			attemptCount: 1,
		} as any;
		mockTwitterPost([
			{ type: "video", url: "https://video.twimg.com/123.mp4" },
			{ type: "video", url: "https://video.twimg.com/456.mp4" },
		]);
		for (const clip of ["first", "second"]) {
			fetchMock.mockResolvedValueOnce(
				new Response(clip, { headers: { "content-type": "video/mp4" } }),
			);
		}
		vi.mocked(JobRepository.update).mockImplementation(async (_id, data) => {
			job.payload = data.payload;
		});
		mockMediaRegisterAndProcess
			.mockResolvedValueOnce({ id: "first" })
			.mockRejectedValueOnce(new Error("registration interrupted"))
			.mockResolvedValueOnce({ id: "second" });
		await expect(processDownloadJob(job)).rejects.toThrow(
			"registration interrupted",
		);
		expect(job.payload.nextOutput).toBe(1);
		job.attemptCount++;
		await processDownloadJob(job);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(
			mockMediaRegisterAndProcess.mock.calls.map((call) => call[1]),
		).toEqual([
			expect.stringMatching(/_0\.mp4$/),
			expect.stringMatching(/_1\.mp4$/),
			expect.stringMatching(/_1\.mp4$/),
		]);
	});
	it("preserves a concurrently published video and resumes registration at the chosen filename", async () => {
		const disk =
			await vi.importActual<typeof import("node:fs/promises")>(
				"node:fs/promises",
			);
		const dir = await disk.mkdtemp(
			path.join(os.tmpdir(), "download-collision-"),
		);
		try {
			mockFindById.mockResolvedValue({
				id: "source-1",
				type: "local",
				connectionInfo: { path: dir },
			});
			const parentId = crypto.randomUUID();
			const job = {
				id: crypto.randomUUID(),
				parentId,
				attemptCount: 1,
				type: "downloadImage",
				mediaSourceId: "source-1",
				payload: {
					targetUrl: "https://x.com/user/status/123",
					importBatchId: crypto.randomUUID(),
					importTargetId: parentId,
				},
			} as any;
			mockTwitterPost([
				{ type: "video", url: "https://video.twimg.com/123.mp4" },
			]);
			fetchMock.mockResolvedValueOnce(
				new Response("this download", {
					headers: { "content-type": "video/mp4" },
				}),
			);
			vi.mocked(fs.writeFile).mockImplementation(disk.writeFile);
			vi.mocked(JobRepository.update).mockImplementation(async (_id, data) => {
				job.payload = data.payload;
			});
			vi.mocked(fs.access).mockImplementation(disk.access);
			vi.mocked(fs.stat).mockImplementation(disk.stat);
			vi.mocked(fs.unlink).mockImplementation(disk.unlink);
			let occupied = "";
			vi.mocked(fs.link)
				.mockImplementation(disk.link)
				.mockImplementationOnce(async (src, dest) => {
					occupied = String(dest);
					await disk.writeFile(dest, "other download", { flag: "wx" });
					await disk.link(src, dest);
				});
			mockMediaRegisterAndProcess.mockRejectedValueOnce(
				new Error("registration interrupted"),
			);
			await expect(processDownloadJob(job)).rejects.toThrow(
				"registration interrupted",
			);
			job.attemptCount++;
			await processDownloadJob(job);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(await disk.readFile(occupied, "utf8")).toBe("other download");
			const filename = mockMediaRegisterAndProcess.mock.calls[0][1];
			expect(mockMediaRegisterAndProcess.mock.calls[1][1]).toBe(filename);
			expect(await disk.readFile(path.join(dir, filename), "utf8")).toBe(
				"this download",
			);
			expect(await disk.readdir(dir)).toHaveLength(2);
		} finally {
			await disk.rm(dir, { recursive: true, force: true });
		}
	});
	it("should resolve a direct image timestamp from vxTwitter metadata", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response("image", { headers: { "content-type": "image/jpeg" } }),
		);
		mockTwitterPost([]);
		const job = {
			id: "job-vx-metadata",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: "https://example.com/image.jpg",
				sourceUrls: ["https://x.com/user/status/123"],
			},
		} as any;

		await processDownloadJob(job);
		expect(fetchMock).toHaveBeenLastCalledWith(
			VXTWITTER_API_URL,
			expect.any(Object),
		);
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.any(String),
			expect.objectContaining({ createdAt: POST_DATE }),
		);
	});

	it("should process a direct image download via MediaProcessingService", async () => {
		const { MediaProcessingService } =
			await import("~/infrastructure/services/media-processing-service");

		const item = {
			targetUrl: "https://example.com/image.jpg",
			description: "Test Description",
			sourceUrls: ["https://x.com/user/status/123"],
			authors: [{ name: "User", accountId: "@user" }],
		};

		const job = {
			id: "job-1",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { ...item },
		} as any;

		await processDownloadJob(job);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://example.com/image.jpg",
			expect.any(Object),
		);

		// Verify MediaProcessingService.registerAndProcess was called with correct context
		expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.stringMatching(DOWNLOAD_FILENAME_PATTERN),
			expect.objectContaining({
				description: "Test Description",
				sourceUrls: expect.arrayContaining([
					"https://example.com/image.jpg",
					"https://x.com/user/status/123",
				]),
				authors: [{ name: "User", accountId: "@user" }],
			}),
		);
	});

	it("should download a Pixiv original with the artwork page as Referer and preserve both source URLs", async () => {
		const targetUrl =
			"https://i.pximg.net/img-original/img/2026/09/30/12/00/00/123456789_p1.png";
		const artworkUrl = "https://www.pixiv.net/artworks/123456789";
		const sourceUrls = [targetUrl, artworkUrl];
		const createdAt = new Date("2026-09-30T12:00:00+09:00");
		fetchMock.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "image/png" }),
			arrayBuffer: async () => new ArrayBuffer(10),
		});
		const job = {
			id: "job-pixiv-original",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl,
				sourceUrls,
				createdAt: createdAt.toISOString(),
				description: "Pixiv artwork description",
				authors: [{ name: "Pixiv Artist", accountId: "12345" }],
				tags: [{ name: "オリジナル", source: "pixiv" }],
			},
		} as any;

		await processDownloadJob(job);

		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			targetUrl,
			expect.objectContaining({
				headers: expect.objectContaining({ Referer: artworkUrl }),
			}),
		);
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.stringMatching(/123456789_p1\.png$/),
			expect.objectContaining({
				sourceUrls,
				createdAt,
				description: "Pixiv artwork description",
				authors: job.payload.authors,
				tags: job.payload.tags,
			}),
		);
	});

	it("converts ugoira and registers only the completed MP4 with its artwork metadata", async () => {
		const targetUrl =
			"https://i.pximg.net/img-zip-ugoira/img/2022/09/05/00/00/00/101003492_ugoira1920x1080.zip";
		const sourceUrls = [targetUrl, "https://www.pixiv.net/artworks/101003492"];
		const ugoira = {
			frames: [
				{ file: "000000.jpg", delay: 50 },
				{ file: "000001.jpg", delay: 120 },
			],
		};
		const job = {
			id: "job-ugoira",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl,
				sourceUrls,
				ugoira,
				description: "Animation",
				authors: [{ name: "Artist", accountId: "123", platform: "pixiv" }],
				tags: [{ name: "animation", source: "pixiv" }],
				createdAt: "2022-09-05T00:00:00Z",
			},
		} as any;
		vi.mocked(fs.link)
			.mockRejectedValueOnce(
				Object.assign(new Error("exists"), { code: "EEXIST" }),
			)
			.mockResolvedValueOnce();

		await processDownloadJob(job);

		expect(mockDownloadUgoiraArchive).toHaveBeenCalledWith(
			expect.objectContaining({ targetUrl, sourceUrls, ugoira }),
			"/tmp/downloads/.xtracter-ugoira-fixture/frames.zip",
		);
		expect(mockConvertUgoiraToMp4).toHaveBeenCalledWith(
			"/tmp/downloads/.xtracter-ugoira-fixture/frames.zip",
			"/tmp/downloads/.xtracter-ugoira-fixture/animation.mp4",
			ugoira.frames,
		);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mockSaveFile).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.stringMatching(/_\(1\)\.mp4$/),
			expect.objectContaining({
				sourceUrls,
				authors: job.payload.authors,
				tags: job.payload.tags,
				createdAt: new Date(job.payload.createdAt),
			}),
		);
		expect(fs.rm).toHaveBeenCalledWith(
			"/tmp/downloads/.xtracter-ugoira-fixture",
			{ recursive: true, force: true },
		);
	});

	it.each(["download", "convert", "metadata"])(
		"cleans ugoira staging and reports %s failure without publishing media",
		async (phase) => {
			const error = new Error(`${phase} failed`);
			if (phase === "download")
				mockDownloadUgoiraArchive.mockRejectedValueOnce(error);
			if (phase === "convert")
				mockConvertUgoiraToMp4.mockRejectedValueOnce(error);
			if (phase === "metadata") vi.mocked(fs.stat).mockRejectedValueOnce(error);
			const targetUrl =
				"https://i.pximg.net/img-zip-ugoira/101003492_ugoira1920x1080.zip";
			const job = {
				id: "job-ugoira-failure",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: {
					targetUrl,
					sourceUrls: [targetUrl, "https://www.pixiv.net/artworks/101003492"],
					ugoira: { frames: [{ file: "0.jpg", delay: 50 }] },
				},
			} as any;
			await expect(processDownloadJob(job)).rejects.toThrow(error);
			expect(fs.link).not.toHaveBeenCalled();
			expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
			expect(fs.rm).toHaveBeenCalledWith(
				"/tmp/downloads/.xtracter-ugoira-fixture",
				{ recursive: true, force: true },
			);
			expect(RealtimeEventBus.publishSource).toHaveBeenCalledExactlyOnceWith(
				"source-1",
				"download-error",
				{ url: targetUrl, error: error.message },
			);
		},
	);

	it.each([false, true])(
		"cleans a failed registration only when no media row owns the MP4 (registered=%s)",
		async (registered) => {
			mockMediaRegisterAndProcess.mockRejectedValueOnce(
				new Error("registration failed"),
			);
			mockMediaFindByPath.mockResolvedValue(
				registered ? { id: "watcher-media" } : null,
			);
			mockMediaAddContextMetadata.mockRejectedValueOnce(
				new Error("context update failed"),
			);
			const targetUrl =
				"https://i.pximg.net/img-zip-ugoira/101003492_ugoira1920x1080.zip";
			const job = {
				id: "failed-registration",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: {
					targetUrl,
					sourceUrls: [targetUrl, "https://www.pixiv.net/artworks/101003492"],
					ugoira: { frames: [{ file: "0.jpg", delay: 50 }] },
				},
			} as any;
			await expect(processDownloadJob(job)).rejects.toThrow();
			if (registered) expect(fs.unlink).not.toHaveBeenCalled();
			else
				expect(fs.unlink).toHaveBeenCalledWith(
					expect.stringMatching(/^\/tmp\/downloads\/[^/]+\.mp4$/),
				);
			expect(fs.rm).toHaveBeenCalledWith(
				"/tmp/downloads/.xtracter-ugoira-fixture",
				{ recursive: true, force: true },
			);
		},
	);

	it("rejects malformed ugoira payloads instead of downloading a still image", async () => {
		const job = {
			id: "bad-ugoira",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: "https://i.pximg.net/file.jpg",
				ugoira: { frames: [{ file: "../bad.jpg", delay: 50 }] },
			},
		} as any;
		await expect(processDownloadJob(job)).rejects.toThrow();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mockConvertUgoiraToMp4).not.toHaveBeenCalled();
	});

	it.each(["mp4", "webm"])(
		"downloads a Danbooru %s original and retains its import metadata",
		async (extension) => {
			const targetUrl = `https://cdn.donmai.us/original/123.${extension}`;
			const sourceUrls = [targetUrl, "https://danbooru.donmai.us/posts/123"];
			const payload = {
				targetUrl,
				sourceUrls,
				createdAt: "2026-01-01T00:00:00Z",
				authors: [
					{ name: "artist", accountId: "artist", platform: "danbooru" },
				],
				tags: [{ name: "animation", source: "danbooru" }],
			};
			const bytes = new ArrayBuffer(12);
			fetchMock.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({
					"content-type": `video/${extension}; charset=binary`,
				}),
				arrayBuffer: async () => bytes,
			});
			await processDownloadJob({
				id: "job-danbooru-video",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload,
			} as any);
			expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
				targetUrl,
				expect.any(Object),
			);
			const file = mockSaveFile.mock.calls[0][1];
			expect(file.name).toMatch(new RegExp(`\\.${extension}$`));
			expect(await file.arrayBuffer()).toBe(bytes);
			expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
				"source-1",
				expect.stringMatching(new RegExp(`\\.${extension}$`)),
				expect.objectContaining({
					sourceUrls,
					authors: payload.authors,
					tags: payload.tags,
					createdAt: new Date(payload.createdAt),
				}),
			);
		},
	);
	it.each([
		"text/html",
		"application/zip",
		"application/octet-stream",
		"video/quicktime",
		"__proto__",
		"",
	])(
		"rejects unsupported direct download responses (%s)",
		async (contentType) => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				headers: new Headers(
					contentType ? { "content-type": contentType } : {},
				),
				arrayBuffer: async () => new ArrayBuffer(10),
			});

			const job = {
				id: "job-non-image",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: {
					targetUrl: "https://cdn.donmai.us/original/123.mp4",
				},
			} as any;

			await expect(processDownloadJob(job)).rejects.toThrow(
				`Unsupported direct media content type: ${contentType || "unknown content type"}`,
			);
			expect(mockSaveFile).not.toHaveBeenCalled();
			expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
		},
	);

	it.each([
		{
			targetUrl: "https://example.com/page.html",
			contentType: "image/jpeg",
			expectedExtension: /\.jpg$/,
		},
		{
			targetUrl: "https://example.com/image?format=html",
			contentType: "image/jpeg",
			expectedExtension: /\.jpg$/,
		},
	])(
		"should derive the direct download extension from the response MIME type ($targetUrl, $contentType)",
		async ({ targetUrl, contentType, expectedExtension }) => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ "content-type": contentType }),
				arrayBuffer: async () => new ArrayBuffer(10),
			});

			const job = {
				id: "job-extension",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: { targetUrl },
			} as any;

			await processDownloadJob(job);

			expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
				"source-1",
				expect.stringMatching(expectedExtension),
				expect.anything(),
			);
		},
	);

	it("should reject unsupported image MIME types", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "image/x-custom" }),
			arrayBuffer: async () => new ArrayBuffer(10),
		});

		const job = {
			id: "job-unsupported-image",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: "https://example.com/page.html" },
		} as any;

		await expect(processDownloadJob(job)).rejects.toThrow(
			"Unsupported direct media content type: image/x-custom",
		);
		expect(mockSaveFile).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
	});

	it("should use description if provided", async () => {
		const { MediaProcessingService } =
			await import("~/infrastructure/services/media-processing-service");

		const item = {
			targetUrl: "https://example.com/image.png",
			description: "My Description",
		};
		const job = {
			id: "job-2",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { ...item },
		} as any;

		await processDownloadJob(job);

		expect(MediaProcessingService.registerAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.any(String),
			expect.objectContaining({
				description: "My Description",
			}),
		);
	});

	it("should update existing media metadata if file already exists", async () => {
		const { MediaProcessingService } =
			await import("~/infrastructure/services/media-processing-service");

		// Simulate file existing -> registerAndProcess throws -> catch block searches media -> updates
		const error = new Error("File already exists");
		mockMediaRegisterAndProcess.mockRejectedValueOnce(error);

		mockMediaFindByPath.mockResolvedValueOnce({
			id: "existing-media-id",
		} as any);

		const item = {
			targetUrl: "https://example.com/duplicate.jpg",
			description: "Updated Description",
			authors: [{ name: "New Author", accountId: "@new" }],
		};

		const job = {
			id: "job-3",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { ...item },
		} as any;

		await processDownloadJob(job);

		expect(MediaRepository.findByPath).toHaveBeenCalled();
		expect(
			MediaProcessingService.addContextMetadataToExistingMedia,
		).toHaveBeenCalledWith(
			"existing-media-id",
			expect.objectContaining({
				description: "Updated Description",
				authors: [{ name: "New Author", accountId: "@new" }],
			}),
		);
	});
});

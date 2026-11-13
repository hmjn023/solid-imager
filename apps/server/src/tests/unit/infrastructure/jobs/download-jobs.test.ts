import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	processDownloadJob,
	queueDownloadJobs,
} from "~/infrastructure/jobs/download-jobs";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import {
	MediaGroupRepository,
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
	mockYtDlpExec,
	mockYtDlp,
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
	mockYtDlpExec: vi.fn(),
	mockYtDlp: vi.fn(),
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
vi.mock("youtube-dl-exec", () => ({
	create: () => Object.assign(mockYtDlp, { exec: mockYtDlpExec }),
}));
vi.mock("~/infrastructure/utils/ffmpeg", () => ({
	resolveFfmpegPath: vi.fn().mockResolvedValue("/usr/bin/ffmpeg"),
}));
vi.mock("~/infrastructure/jobs/download-rate-limiter", () => ({
	waitForDownloadRateLimit: vi.fn(),
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/infrastructure/db/repositories", () => ({
	MediaGroupRepository: { observe: vi.fn() },
	DrizzleSourceRepository: {
		findById: mockFindById,
	},
	MediaRepository: {
		findMediaIdWithMatchingUrlSet: vi.fn(),
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

	it.each([
		{
			error: Object.assign(new Error(""), {
				stderr: "ERROR: HTTP Error 403",
				exitCode: 1,
			}),
			message: "yt-dlp failed (exit code 1): ERROR: HTTP Error 403",
		},
		{
			error: Object.assign(new Error(""), { stderr: "", exitCode: 1 }),
			message: "yt-dlp failed (exit code 1): process failed without stderr",
		},
		{
			error: Object.assign(new Error(""), {
				stderr: "",
				exitCode: null,
				signalCode: "SIGKILL",
			}),
			message: "yt-dlp failed (signal SIGKILL): process failed without stderr",
		},
		{
			error: Object.assign(new Error("spawn yt-dlp ENOENT"), {
				code: "ENOENT",
			}),
			message: "yt-dlp failed (code ENOENT): process failed without stderr",
		},
		{
			error: new Error(""),
			message: "yt-dlp failed: unknown execution error (no diagnostic output)",
		},
	])(
		"should preserve yt-dlp failure diagnostics: $message",
		async ({ error, message }) => {
			mockYtDlpExec.mockRejectedValueOnce(error);
			const job = {
				id: "job-ytdlp-error",
				mediaSourceId: "source-1",
				type: "downloadImage",
				payload: { targetUrl: "https://x.com/user/status/123" },
			} as any;

			await expect(processDownloadJob(job)).rejects.toMatchObject({
				message,
				cause: error,
			});
			expect(logger.error).toHaveBeenCalledWith(
				{ err: expect.objectContaining({ message, cause: error }) },
				"yt-dlp execution failed",
			);
			expect(RealtimeEventBus.publishSource).toHaveBeenCalledWith(
				"source-1",
				"download-error",
				{ url: job.payload.targetUrl, error: message },
			);
			expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
		},
	);

	it("should process raw yt-dlp JSON output without using the error-reparsing wrapper", async () => {
		mockYtDlpExec.mockResolvedValueOnce({
			stdout: JSON.stringify({
				id: "123",
				title: "Video",
				description: "Video description",
				ext: "mp4",
				filename: "/tmp/downloads/123.mp4",
			}),
			stderr: "",
			exitCode: 0,
		});
		const job = {
			id: "job-ytdlp-success",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: "https://x.com/user/status/123" },
		} as any;

		await processDownloadJob(job);
		expect(mockYtDlpExec).toHaveBeenCalledWith(
			job.payload.targetUrl,
			expect.objectContaining({ printJson: true, simulate: false }),
		);
		expect(mockYtDlp).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.stringMatching(/\.mp4$/),
			expect.objectContaining({ description: "Video description" }),
		);
	});

	it("should fail the job when yt-dlp returns no valid media metadata", async () => {
		mockYtDlpExec.mockResolvedValueOnce({
			stdout: "not JSON",
			stderr: "  extractor reported no metadata\n",
			exitCode: 0,
		});
		const job = {
			id: "job-ytdlp-invalid-json",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: "https://x.com/user/status/123" },
		} as any;

		await expect(processDownloadJob(job)).rejects.toThrow(
			"yt-dlp returned no valid media metadata: extractor reported no metadata",
		);
		expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
	});

	it("should register every media item in newline-delimited yt-dlp output", async () => {
		const stdout = ["123", "456"]
			.map((id) =>
				JSON.stringify({
					id,
					title: "Video",
					description: "Video description",
					ext: "mp4",
					filename: `/tmp/downloads/${id}.mp4`,
				}),
			)
			.join("\n");
		mockYtDlpExec.mockResolvedValueOnce({ stdout, stderr: "", exitCode: 0 });
		const job = {
			id: "job-ytdlp-multiple",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: "https://x.com/user/status/123" },
		} as any;

		await processDownloadJob(job);
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledTimes(2);
	});

	it("should resolve a direct image timestamp from raw yt-dlp metadata", async () => {
		mockYtDlpExec.mockResolvedValueOnce({
			stdout: JSON.stringify({
				id: "123",
				title: "Post",
				description: "Description",
				ext: "jpg",
				filename: "image.jpg",
				upload_date: "20260930",
			}),
			stderr: "",
			exitCode: 0,
		});
		const job = {
			id: "job-ytdlp-metadata",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: "https://example.com/image.jpg",
				sourceUrls: ["https://x.com/user/status/123"],
			},
		} as any;

		await processDownloadJob(job);
		expect(mockYtDlpExec).toHaveBeenCalledWith(
			"https://x.com/user/status/123",
			expect.objectContaining({ dumpSingleJson: true, skipDownload: true }),
		);
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			expect.any(String),
			expect.objectContaining({ createdAt: new Date("2026-09-30") }),
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

		expect(MediaGroupRepository.observe).toHaveBeenCalledWith("media-1", {
			platform: "twitter",
			postId: "123",
			position: null,
		});
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
		expect(mockYtDlpExec).not.toHaveBeenCalled();
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
		expect(mockYtDlpExec).not.toHaveBeenCalled();
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

	it("should reject non-image direct download responses", async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ "content-type": "text/html" }),
			arrayBuffer: async () => new ArrayBuffer(10),
		});

		const job = {
			id: "job-non-image",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: "https://x.com/home",
			},
		} as any;

		await expect(processDownloadJob(job)).rejects.toThrow(
			"non-image response: text/html",
		);
		expect(mockSaveFile).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).not.toHaveBeenCalled();
	});

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
			"Unsupported image content type: image/x-custom",
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
	it("adds source grouping to an already downloaded item without enqueueing another download", async () => {
		vi.mocked(MediaRepository.findMediaIdWithMatchingUrlSet).mockResolvedValue(
			"media-1",
		);
		const item = {
			targetUrl: "https://pbs.twimg.com/media/image.jpg",
			sourceUrls: [
				"https://pbs.twimg.com/media/image.jpg",
				"https://x.com/user/status/123",
			],
		};
		expect(await queueDownloadJobs("source-1", [item])).toEqual({
			jobCount: 0,
			skippedCount: 1,
		});
		expect(MediaGroupRepository.observe).toHaveBeenCalledWith(
			"media-1",
			{ platform: "twitter", postId: "123", position: null },
			undefined,
		);
	});
	it("fails retryably instead of redownloading when existing-media grouping cannot be persisted", async () => {
		vi.mocked(MediaRepository.findMediaIdWithMatchingUrlSet).mockResolvedValue(
			"media-1",
		);
		vi.mocked(MediaGroupRepository.observe).mockRejectedValueOnce(
			new Error("group write failed"),
		);
		await expect(
			queueDownloadJobs("source-1", [
				{
					targetUrl: "https://pbs.twimg.com/media/image.jpg",
					sourceUrls: [
						"https://pbs.twimg.com/media/image.jpg",
						"https://x.com/user/status/123",
					],
				},
			]),
		).rejects.toThrow("group write failed");
	});
});

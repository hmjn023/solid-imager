import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processDownloadJob } from "~/infrastructure/jobs/download-jobs";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

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
}));

// Mocks
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
vi.mock("~/infrastructure/repositories/source-repository", () => ({
	DrizzleSourceRepository: {
		findById: mockFindById,
	},
}));
vi.mock("~/infrastructure/repositories/media-repository", () => ({
	MediaRepository: {
		create: mockMediaCreate,
		update: mockMediaUpdate,
		addUrls: mockMediaAddUrls,
		findByPath: mockMediaFindByPath,
	},
}));
vi.mock("~/infrastructure/repositories/author-repository", () => ({
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

	MediaProcessingServiceImpl: class {},
}));
vi.mock("node:fs/promises", () => ({
	default: {
		mkdir: vi.fn(),
		writeFile: vi.fn(),
		unlink: vi.fn(),
		access: vi.fn(),
		rename: vi.fn(),
		stat: vi.fn(),
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
		vi.mocked(fs.rm).mockResolvedValue(undefined);
		vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
		const modifiedAt = new Date("2026-01-01T00:00:00Z");
		vi.mocked(fs.stat).mockResolvedValue({
			size: 1000,
			mtime: modifiedAt,
			dev: 1,
			ino: 1,
		} as any);
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

		mockGetFileMetadata.mockResolvedValue({
			size: 1000,
			createdAt: new Date(),
			modifiedAt: new Date("2026-01-01T00:00:00Z"),
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
				modifiedAt: new Date("2026-01-01T00:00:00Z"),
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
			modifiedAt: new Date("2026-01-01T00:00:00Z"),
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
			modifiedAt: new Date("2026-01-01T00:00:00Z"),
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
			withActiveAttempt: vi.fn(async (_id, _attempt, action) =>
				action(undefined),
			),
			update: vi.fn(),
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
				filename: "123.mp4",
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
			expect.objectContaining({ sourcePath: "/tmp/downloads" }),
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
					filename: `${id}.mp4`,
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
			expect.objectContaining({ sourcePath: "/tmp/downloads" }),
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
			expect.objectContaining({ sourcePath: "/tmp/downloads" }),
		);
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
				expect.objectContaining({ sourcePath: "/tmp/downloads" }),
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
			expect.objectContaining({ sourcePath: "/tmp/downloads" }),
		);
	});

	it("resumes checkpointed files without downloading again", async () => {
		const job = {
			id: "job-resume",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: {
				targetUrl: "https://example.com/image.jpg",
				downloadRegistration: {
					version: 1,
					mediaSourceId: "source-1",
					sourcePath: "/tmp/downloads",
					stagingDirectory:
						"/tmp/downloads/.solid-imager-downloads/job-resume/1",
					entries: [
						{
							stagedPath:
								"/tmp/downloads/.solid-imager-downloads/job-resume/1/image.jpg",
							filePath: "image.jpg",
							fileSize: 1000,
							modifiedAt: "2026-01-01T00:00:00Z",
							published: true,
							context: {
								sourceUrls: [
									"https://example.com/image.jpg",
									"https://example.com/post",
								],
							},
						},
					],
				},
			},
		} as any;
		await processDownloadJob(job);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mockSaveFile).not.toHaveBeenCalled();
		expect(mockYtDlpExec).not.toHaveBeenCalled();
		expect(mockMediaRegisterAndProcess).toHaveBeenCalledWith(
			"source-1",
			"image.jpg",
			expect.objectContaining({
				sourceUrls: [
					"https://example.com/image.jpg",
					"https://example.com/post",
				],
			}),
			expect.objectContaining({ sourcePath: "/tmp/downloads" }),
		);
	});
	it("does not hide registration failures when the watcher already registered a media", async () => {
		mockMediaRegisterAndProcess.mockRejectedValueOnce(
			new Error("processing reservation failed"),
		);
		mockMediaFindByPath.mockResolvedValue({ id: "watcher-media" });
		const job = {
			id: "job-reservation-failure",
			mediaSourceId: "source-1",
			type: "downloadImage",
			payload: { targetUrl: "https://example.com/image.jpg" },
		} as any;
		await expect(processDownloadJob(job)).rejects.toThrow(
			"processing reservation failed",
		);
		expect(mockMediaAddContextMetadata).not.toHaveBeenCalled();
		expect(MediaRepository.findByPath).not.toHaveBeenCalled();
	});
});

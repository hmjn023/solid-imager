import {
	type ITaggingService,
	type ResolveVideoThumbnail,
	type TaggingServiceDeps,
	createTaggingService,
} from "@solid-imager/application/tagging";
import type { IAiClient } from "@solid-imager/core/ports";
import type { CharacterRepository } from "@solid-imager/core/characters";
import type { IIpRepository } from "@solid-imager/core/ips";
import type { SourceRepository } from "@solid-imager/core/sources";
import type { TagRepository } from "@solid-imager/core/tags";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_BUFFER_DATA = [1, 2, 3];

describe("createTaggingService", () => {
	let taggingService: ITaggingService;
	let mockAiClient: IAiClient;
	let mockSourceRepo: SourceRepository;
	let mockMediaRepo: TaggingServiceDeps["mediaRepo"];
	let mockTagRepo: TagRepository;
	let mockCharacterRepo: CharacterRepository;
	let mockIpRepo: IIpRepository;
	let mockSseSendEvent: ReturnType<typeof vi.fn>;
	let mockReadFileBuffer: ReturnType<typeof vi.fn>;
	let resolveVideoThumbnail: ReturnType<typeof vi.fn<ResolveVideoThumbnail>>;

	beforeEach(() => {
		mockAiClient = {
			healthCheck: vi.fn(() => Promise.resolve(true)),
			tagImage: vi.fn(),
			tagImageByPath: vi.fn(),
			extractCcipFeature: vi.fn(),
			extractCcipFeatureByPath: vi.fn(),
			calculateCcipDifference: vi.fn(),
		} as unknown as IAiClient;

		mockSourceRepo = {
			findById: vi.fn((id: string) =>
				Promise.resolve({
					id,
					type: "local",
					connectionInfo: { path: "/mock" },
				}),
			),
		} as unknown as SourceRepository;

		mockMediaRepo = {
			clearAiAssociations: vi.fn(),
			findById: vi.fn().mockResolvedValue({
				id: "media-1",
				mediaSourceId: "source-1",
				mediaType: "image",
				filePath: "remote/path.jpg",
			}),
		};

		mockTagRepo = {
			findByMediaId: vi.fn(() => Promise.resolve([])),
			addTagsToMedia: vi.fn(() => Promise.resolve()),
		} as unknown as TagRepository;

		mockIpRepo = {
			findByName: vi.fn((name: string) =>
				Promise.resolve(
					name === "ExistingIP" ? { id: "ip-1", name: "ExistingIP" } : null,
				),
			),
			findOrCreateBulk: vi.fn(() =>
				Promise.resolve([{ id: "ip-vocaloid", name: "Vocaloid" }]),
			),
			create: vi.fn((data: { name: string }) =>
				Promise.resolve({ id: "ip-new", name: data.name }),
			),
			addMediaBulk: vi.fn(() => Promise.resolve()),
			getMediaIps: vi.fn(() => Promise.resolve([])),
		} as unknown as IIpRepository;

		mockCharacterRepo = {
			findByName: vi.fn(() => Promise.resolve(null)),
			findByNames: vi.fn(() => Promise.resolve([])),
			findOrCreateBulk: vi.fn(
				(data: Array<{ name: string; ipIds?: string[] }>) =>
					Promise.resolve(
						data.map((d) => ({
							id: `char-${d.name}`,
							name: d.name,
							ips: (d.ipIds ?? []).map((ipId: string) => ({
								id: ipId,
								name: ipId,
							})),
						})),
					),
			),
			create: vi.fn((data: { name: string; ipId?: string }) =>
				Promise.resolve({ id: "char-new", name: data.name, ipId: data.ipId }),
			),
			update: vi.fn(() => Promise.resolve()),
			addToMediaBulk: vi.fn(() => Promise.resolve()),
			getMediaCharacters: vi.fn(() => Promise.resolve([])),
		} as unknown as CharacterRepository;

		mockSseSendEvent = vi.fn();
		mockReadFileBuffer = vi.fn(() =>
			Promise.resolve(new Uint8Array(MOCK_BUFFER_DATA).buffer as ArrayBuffer),
		);
		resolveVideoThumbnail = vi.fn().mockResolvedValue("/cache/video.webp");

		const deps: TaggingServiceDeps = {
			transactionManager: {
				transaction: (callback) => callback("test-transaction"),
			},
			aiClient: mockAiClient,
			sourceRepo: mockSourceRepo,
			mediaRepo: mockMediaRepo,
			tagRepo: mockTagRepo,
			characterRepo: mockCharacterRepo,
			ipRepo: mockIpRepo,
			publishSourceEvent: mockSseSendEvent as any,
			readFileBuffer: mockReadFileBuffer as any,
			resolveVideoThumbnail,
		};

		taggingService = createTaggingService(deps);
	});

	const emptyTags = {
		general: {},
		character: {},
		attributes: {},
		ips: [],
		ips_mapping: {},
	};
	const video = {
		id: "media-1",
		mediaSourceId: "source-1",
		mediaType: "video",
		filePath: "clip.mp4",
		modifiedAt: new Date("2026-01-01"),
	};

	it("tags the video thumbnail and stores tags against the original video", async () => {
		vi.mocked(mockMediaRepo.findById).mockResolvedValue(video as any);
		vi.mocked(mockAiClient.tagImageByPath).mockResolvedValue({
			...emptyTags,
			general: { outdoors: 0.9 },
		});
		await taggingService.getTagsForMedia("source-1", "media-1");
		expect(resolveVideoThumbnail).toHaveBeenCalledWith(video);
		expect(mockAiClient.tagImageByPath).toHaveBeenCalledWith(
			"/cache/video.webp",
		);
		expect(mockTagRepo.addTagsToMedia).toHaveBeenCalledWith(
			"media-1",
			[expect.objectContaining({ name: "outdoors" })],
			"AI",
			"test-transaction",
		);
		expect(mockSseSendEvent).toHaveBeenCalledWith(
			"source-1",
			"media-changed",
			expect.objectContaining({ mediaId: "media-1", filePath: "clip.mp4" }),
		);
	});

	it("uses thumbnail bytes for remote tagging and CCIP, never video bytes", async () => {
		vi.mocked(mockMediaRepo.findById).mockResolvedValue(video as any);
		mockAiClient.getBaseUrl = () => "https://ai.example.test";
		vi.mocked(mockAiClient.tagImage).mockResolvedValue(emptyTags);
		vi.mocked(mockAiClient.extractCcipFeature).mockResolvedValue({
			feature: [1, 2, 3],
		});
		await taggingService.getTagsForMedia("source-1", "media-1");
		await taggingService.getCcipFeatureForMedia("source-1", "media-1");
		expect(mockReadFileBuffer).toHaveBeenCalledTimes(2);
		expect(mockReadFileBuffer).toHaveBeenNthCalledWith(1, "/cache/video.webp");
		expect(mockReadFileBuffer).toHaveBeenNthCalledWith(2, "/cache/video.webp");
		expect(mockAiClient.tagImageByPath).not.toHaveBeenCalled();
		expect(mockAiClient.extractCcipFeatureByPath).not.toHaveBeenCalled();
	});

	it("extracts local video CCIP from the thumbnail and propagates generation errors", async () => {
		vi.mocked(mockMediaRepo.findById).mockResolvedValue(video as any);
		vi.mocked(mockAiClient.extractCcipFeatureByPath).mockResolvedValue({
			feature: [1],
		});
		await expect(
			taggingService.getCcipFeatureForMedia("source-1", "media-1"),
		).resolves.toEqual({ feature: [1] });
		expect(mockAiClient.extractCcipFeatureByPath).toHaveBeenCalledWith(
			"/cache/video.webp",
		);
		resolveVideoThumbnail.mockRejectedValue(new Error("thumbnail failed"));
		await expect(
			taggingService.getTagsForMedia("source-1", "media-1"),
		).rejects.toThrow("thumbnail failed");
		expect(mockTagRepo.addTagsToMedia).not.toHaveBeenCalled();
	});

	it("does not generate thumbnails for cached tags, other sources or audio", async () => {
		vi.mocked(mockMediaRepo.findById).mockResolvedValue(video as any);
		vi.mocked(mockTagRepo.findByMediaId).mockResolvedValue([
			{ name: "outdoors", source: "AI", confidence: 0.9 },
		] as any);
		await expect(
			taggingService.getTagsForMedia("source-1", "media-1"),
		).resolves.toMatchObject({ general: { outdoors: 0.9 } });
		await expect(
			taggingService.getTagsForMedia("source-2", "media-1"),
		).rejects.toThrow("Media not found in source");
		vi.mocked(mockMediaRepo.findById).mockResolvedValue({
			...video,
			mediaType: "audio",
		} as any);
		await expect(
			taggingService.getCcipFeatureForMedia("source-1", "media-1"),
		).rejects.toThrow("images and video thumbnails");
		expect(resolveVideoThumbnail).not.toHaveBeenCalled();
	});

	it("should correctly link characters to IPs based on ips_mapping", async () => {
		// Setup AI response with character -> ip mapping
		(mockAiClient.tagImage as any).mockResolvedValue({
			general: { "1girl": 0.9 },
			attributes: { "1girl": "general" },

			character: { HatsuneMiku: 0.95 },
			ips: ["Vocaloid"],

			ips_mapping: {
				// Character Name -> List of IP Names

				HatsuneMiku: ["Vocaloid"],
			},
		});

		(mockAiClient.tagImageByPath as any).mockResolvedValue({
			general: { "1girl": 0.9 },
			attributes: { "1girl": "general" },

			character: { HatsuneMiku: 0.95 },
			ips: ["Vocaloid"],

			ips_mapping: {
				HatsuneMiku: ["Vocaloid"],
			},
		});

		await taggingService.getTagsForMedia("source-1", "media-1");

		expect(mockTagRepo.addTagsToMedia).toHaveBeenCalledWith(
			"media-1",
			[
				{
					name: "1girl",
					type: "positive",
					confidence: 0.9,
					attribute: "general",
				},
			],
			"AI",
			"test-transaction",
		);

		// Verify IPs were bulk-created via findOrCreateBulk
		expect(mockIpRepo.findOrCreateBulk).toHaveBeenCalledWith(
			["Vocaloid"],
			"AI",
			"test-transaction",
		);

		// Verify IP was linked to media
		expect(mockIpRepo.addMediaBulk).toHaveBeenCalledWith(
			"media-1",
			expect.arrayContaining([expect.objectContaining({ id: "ip-vocaloid" })]),
			"AI",
			"test-transaction",
		);

		// Verify characters were bulk-created via findOrCreateBulk with IP ids
		expect(mockCharacterRepo.findOrCreateBulk).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					name: "HatsuneMiku",
					ipIds: ["ip-vocaloid"],
				}),
			]),
			"AI",
			"test-transaction",
		);

		// Verify character was linked to media
		expect(mockCharacterRepo.addToMediaBulk).toHaveBeenCalledWith(
			"media-1",
			expect.arrayContaining([
				expect.objectContaining({ id: "char-HatsuneMiku", confidence: 0.95 }),
			]),
			"AI",
			"test-transaction",
		);
	});
});

import {
	type ITaggingService,
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

		const deps: TaggingServiceDeps = {
			aiClient: mockAiClient,
			sourceRepo: mockSourceRepo,
			mediaRepo: mockMediaRepo,
			tagRepo: mockTagRepo,
			characterRepo: mockCharacterRepo,
			ipRepo: mockIpRepo,
			publishSourceEvent: mockSseSendEvent as any,
			readFileBuffer: mockReadFileBuffer as any,
		};

		taggingService = createTaggingService(deps);
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
		);

		// Verify IPs were bulk-created via findOrCreateBulk
		expect(mockIpRepo.findOrCreateBulk).toHaveBeenCalledWith(
			["Vocaloid"],
			"AI",
		);

		// Verify IP was linked to media
		expect(mockIpRepo.addMediaBulk).toHaveBeenCalledWith(
			"media-1",
			expect.arrayContaining([expect.objectContaining({ id: "ip-vocaloid" })]),
			"AI",
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
		);

		// Verify character was linked to media
		expect(mockCharacterRepo.addToMediaBulk).toHaveBeenCalledWith(
			"media-1",
			expect.arrayContaining([
				expect.objectContaining({ id: "char-HatsuneMiku", confidence: 0.95 }),
			]),
			"AI",
		);
	});
});

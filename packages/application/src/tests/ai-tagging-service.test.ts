import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
	isAiServiceLocal,
	orchestrateCcipExtraction,
	orchestrateTagging,
	reconstructTaggingResponseFromCache,
	resolveAiInput,
} from "../services/ai-tagging-service";

type MockedFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

describe("ai-tagging-service", () => {
	describe("isAiServiceLocal", () => {
		it("returns true for localhost", () => {
			expect(isAiServiceLocal("http://localhost:8000")).toBe(true);
		});

		it("returns true for 127.0.0.1", () => {
			expect(isAiServiceLocal("http://127.0.0.1:8000")).toBe(true);
		});

		it("returns true for [::1]", () => {
			expect(isAiServiceLocal("http://[::1]:8000")).toBe(true);
		});

		it("returns false for remote host", () => {
			expect(isAiServiceLocal("http://example.com:8000")).toBe(false);
		});

		it("returns true when baseUrl is undefined", () => {
			expect(isAiServiceLocal(undefined)).toBe(true);
		});

		it("returns true for invalid URL", () => {
			expect(isAiServiceLocal("not-a-url")).toBe(true);
		});
	});

	describe("reconstructTaggingResponseFromCache", () => {
		const mockTagRepo = {
			findByMediaId: vi.fn(),
		} as { findByMediaId: MockedFn<(mediaId: string, tx?: unknown) => any> };
		const mockCharacterRepo = {
			getMediaCharacters: vi.fn(),
		} as {
			getMediaCharacters: MockedFn<(mediaId: string, tx?: unknown) => any>;
		};
		const mockIpRepo = {
			getMediaIps: vi.fn(),
		} as { getMediaIps: MockedFn<(mediaId: string, tx?: unknown) => any> };

		beforeEach(() => {
			mockTagRepo.findByMediaId.mockReset();
			mockCharacterRepo.getMediaCharacters.mockReset();
			mockIpRepo.getMediaIps.mockReset();
		});

		it("returns null when no AI tags exist", async () => {
			mockTagRepo.findByMediaId.mockResolvedValue([
				{ name: "manual-tag", source: "manual", confidence: 1.0 },
			]);
			const result = await reconstructTaggingResponseFromCache("media-1", {
				tagRepository: mockTagRepo as Pick<TagRepository, "findByMediaId">,
				characterRepository: mockCharacterRepo as Pick<
					CharacterRepository,
					"getMediaCharacters"
				>,
				ipRepository: mockIpRepo as Pick<IIpRepository, "getMediaIps">,
			});
			expect(result).toBeNull();
		});

		it("reconstructs response from cached AI data", async () => {
			mockTagRepo.findByMediaId.mockResolvedValue([
				{ name: "1girl", source: "AI", confidence: 0.9 },
			]);
			mockCharacterRepo.getMediaCharacters.mockResolvedValue([
				{
					id: "char-1",
					name: "HatsuneMiku",
					associationSource: "AI",
					confidence: 0.95,
					ips: [{ id: "ip-1", name: "Vocaloid" }],
					description: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);
			mockIpRepo.getMediaIps.mockResolvedValue([
				{
					id: "ip-1",
					name: "Vocaloid",
					associationSource: "AI",
					confidence: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			const result = await reconstructTaggingResponseFromCache("media-1", {
				tagRepository: mockTagRepo as Pick<TagRepository, "findByMediaId">,
				characterRepository: mockCharacterRepo as Pick<
					CharacterRepository,
					"getMediaCharacters"
				>,
				ipRepository: mockIpRepo as Pick<IIpRepository, "getMediaIps">,
			});

			expect(result).toEqual({
				general: { "1girl": 0.9 },
				character: { HatsuneMiku: 0.95 },
				ips: ["Vocaloid"],
				ips_mapping: { HatsuneMiku: ["Vocaloid"] },
			});
		});
	});

	describe("resolveAiInput", () => {
		it("returns path when local source and local AI", async () => {
			const result = await resolveAiInput({
				mediaSourceType: "local",
				mediaSourceConnectionInfo: { path: "/data" },
				mediaFilePath: "img.jpg",
				isAiServiceLocal: true,
				getBuffer: vi.fn(),
				joinPath: (a, b) => `${a}/${b}`,
			});
			expect(result).toEqual({ type: "path", fullPath: "/data/img.jpg" });
		});

		it("returns buffer when remote AI", async () => {
			const getBuffer = vi.fn(async () => new ArrayBuffer(8));
			const result = await resolveAiInput({
				mediaSourceType: "local",
				mediaSourceConnectionInfo: { path: "/data" },
				mediaFilePath: "img.jpg",
				isAiServiceLocal: false,
				getBuffer,
				joinPath: (a, b) => `${a}/${b}`,
			});
			expect(result).toEqual({ type: "buffer", buffer: new ArrayBuffer(8) });
			expect(getBuffer).toHaveBeenCalled();
		});

		it("returns buffer when non-local source", async () => {
			const getBuffer = vi.fn(async () => new ArrayBuffer(8));
			const result = await resolveAiInput({
				mediaSourceType: "s3",
				mediaSourceConnectionInfo: {},
				mediaFilePath: "img.jpg",
				isAiServiceLocal: true,
				getBuffer,
				joinPath: (a, b) => `${a}/${b}`,
			});
			expect(result).toEqual({ type: "buffer", buffer: new ArrayBuffer(8) });
		});
	});

	describe("orchestrateTagging", () => {
		const mockAiClient = {
			tagImage: vi.fn(),
			tagImageByPath: vi.fn(),
		} as {
			tagImage: MockedFn<(buffer: ArrayBuffer) => any>;
			tagImageByPath: MockedFn<(path: string) => any>;
		};

		beforeEach(() => {
			mockAiClient.tagImage.mockReset();
			mockAiClient.tagImageByPath.mockReset();
		});

		it("uses cache when available", async () => {
			const mockTagRepo = {
				findByMediaId: vi.fn(async () => [
					{ name: "cached", source: "AI", confidence: 0.8 },
				]),
			} as { findByMediaId: MockedFn<(mediaId: string, tx?: unknown) => any> };
			const mockCharacterRepo = {
				getMediaCharacters: vi.fn(async () => []),
			} as {
				getMediaCharacters: MockedFn<(mediaId: string, tx?: unknown) => any>;
			};
			const mockIpRepo = {
				getMediaIps: vi.fn(async () => []),
			} as { getMediaIps: MockedFn<(mediaId: string, tx?: unknown) => any> };

			const persistResponse = vi.fn();

			const result = await orchestrateTagging("media-1", undefined, {
				aiClient: mockAiClient as unknown as IAiClient,
				reconstructDeps: {
					tagRepository: mockTagRepo as Pick<TagRepository, "findByMediaId">,
					characterRepository: mockCharacterRepo as Pick<
						CharacterRepository,
						"getMediaCharacters"
					>,
					ipRepository: mockIpRepo as Pick<IIpRepository, "getMediaIps">,
				},
				getAiBaseUrl: () => "http://localhost",
				mediaSourceType: "local",
				mediaSourceConnectionInfo: { path: "/data" },
				mediaFilePath: "img.jpg",
				getBuffer: vi.fn(),
				joinPath: (a, b) => `${a}/${b}`,
				persistResponse,
			});

			expect(result).toEqual({
				general: { cached: 0.8 },
				character: {},
				ips: [],
				ips_mapping: {},
			});
			expect(mockAiClient.tagImage).not.toHaveBeenCalled();
			expect(mockAiClient.tagImageByPath).not.toHaveBeenCalled();
			expect(persistResponse).not.toHaveBeenCalled();
		});

		it("calls tagImageByPath for local source + local AI", async () => {
			const mockTagRepo = {
				findByMediaId: vi.fn(async () => []),
			} as { findByMediaId: MockedFn<(mediaId: string, tx?: unknown) => any> };
			const mockCharacterRepo = {
				getMediaCharacters: vi.fn(async () => []),
			} as {
				getMediaCharacters: MockedFn<(mediaId: string, tx?: unknown) => any>;
			};
			const mockIpRepo = {
				getMediaIps: vi.fn(async () => []),
			} as { getMediaIps: MockedFn<(mediaId: string, tx?: unknown) => any> };

			mockAiClient.tagImageByPath.mockResolvedValue({
				general: { tag: 0.5 },
				character: {},
				ips: [],
				ips_mapping: {},
			});

			const persistResponse = vi.fn();

			await orchestrateTagging(
				"media-1",
				{ skipCache: true },
				{
					aiClient: mockAiClient as unknown as IAiClient,
					reconstructDeps: {
						tagRepository: mockTagRepo as Pick<TagRepository, "findByMediaId">,
						characterRepository: mockCharacterRepo as Pick<
							CharacterRepository,
							"getMediaCharacters"
						>,
						ipRepository: mockIpRepo as Pick<IIpRepository, "getMediaIps">,
					},
					getAiBaseUrl: () => "http://localhost",
					mediaSourceType: "local",
					mediaSourceConnectionInfo: { path: "/data" },
					mediaFilePath: "img.jpg",
					getBuffer: vi.fn(),
					joinPath: (a, b) => `${a}/${b}`,
					persistResponse,
				},
			);

			expect(mockAiClient.tagImageByPath).toHaveBeenCalledWith("/data/img.jpg");
			expect(mockAiClient.tagImage).not.toHaveBeenCalled();
			expect(persistResponse).toHaveBeenCalled();
		});

		it("calls tagImage for remote AI", async () => {
			const mockTagRepo = {
				findByMediaId: vi.fn(async () => []),
			} as { findByMediaId: MockedFn<(mediaId: string, tx?: unknown) => any> };
			const mockCharacterRepo = {
				getMediaCharacters: vi.fn(async () => []),
			} as {
				getMediaCharacters: MockedFn<(mediaId: string, tx?: unknown) => any>;
			};
			const mockIpRepo = {
				getMediaIps: vi.fn(async () => []),
			} as { getMediaIps: MockedFn<(mediaId: string, tx?: unknown) => any> };

			const buffer = new ArrayBuffer(8);
			mockAiClient.tagImage.mockResolvedValue({
				general: { tag: 0.5 },
				character: {},
				ips: [],
				ips_mapping: {},
			});

			const persistResponse = vi.fn();

			await orchestrateTagging(
				"media-1",
				{ skipCache: true },
				{
					aiClient: mockAiClient as unknown as IAiClient,
					reconstructDeps: {
						tagRepository: mockTagRepo as Pick<TagRepository, "findByMediaId">,
						characterRepository: mockCharacterRepo as Pick<
							CharacterRepository,
							"getMediaCharacters"
						>,
						ipRepository: mockIpRepo as Pick<IIpRepository, "getMediaIps">,
					},
					getAiBaseUrl: () => "http://remote.example.com",
					mediaSourceType: "local",
					mediaSourceConnectionInfo: { path: "/data" },
					mediaFilePath: "img.jpg",
					getBuffer: async () => buffer,
					joinPath: (a, b) => `${a}/${b}`,
					persistResponse,
				},
			);

			expect(mockAiClient.tagImage).toHaveBeenCalledWith(buffer);
			expect(mockAiClient.tagImageByPath).not.toHaveBeenCalled();
			expect(persistResponse).toHaveBeenCalled();
		});
	});

	describe("orchestrateCcipExtraction", () => {
		const mockAiClient = {
			extractCcipFeature: vi.fn(),
			extractCcipFeatureByPath: vi.fn(),
		} as {
			extractCcipFeature: MockedFn<(buffer: ArrayBuffer) => any>;
			extractCcipFeatureByPath: MockedFn<(path: string) => any>;
		};

		beforeEach(() => {
			mockAiClient.extractCcipFeature.mockReset();
			mockAiClient.extractCcipFeatureByPath.mockReset();
		});

		it("calls extractCcipFeatureByPath for local source + local AI", async () => {
			mockAiClient.extractCcipFeatureByPath.mockResolvedValue({
				feature: [1, 2, 3],
			});

			const result = await orchestrateCcipExtraction({
				aiClient: mockAiClient as unknown as IAiClient,
				getAiBaseUrl: () => "http://localhost",
				mediaSourceType: "local",
				mediaSourceConnectionInfo: { path: "/data" },
				mediaFilePath: "img.jpg",
				getBuffer: vi.fn(),
				joinPath: (a, b) => `${a}/${b}`,
			});

			expect(mockAiClient.extractCcipFeatureByPath).toHaveBeenCalledWith(
				"/data/img.jpg",
			);
			expect(result).toEqual({ feature: [1, 2, 3] });
		});

		it("calls extractCcipFeature for remote AI", async () => {
			const buffer = new ArrayBuffer(8);
			mockAiClient.extractCcipFeature.mockResolvedValue({
				feature: [4, 5, 6],
			});

			const result = await orchestrateCcipExtraction({
				aiClient: mockAiClient as unknown as IAiClient,
				getAiBaseUrl: () => "http://remote.example.com",
				mediaSourceType: "local",
				mediaSourceConnectionInfo: { path: "/data" },
				mediaFilePath: "img.jpg",
				getBuffer: async () => buffer,
				joinPath: (a, b) => `${a}/${b}`,
			});

			expect(mockAiClient.extractCcipFeature).toHaveBeenCalledWith(buffer);
			expect(result).toEqual({ feature: [4, 5, 6] });
		});
	});
});

import type { Character } from "@solid-imager/core/domain/characters/schemas";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { Media, Preset } from "@solid-imager/core/domain/media/schemas";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { describe, expect, it, vi } from "vite-plus/test";
import { createCharacterService } from "../services/character-service";
import {
	hasMediaProcessingStep,
	queueMediaProcessingJob,
} from "../services/media-processing-job";
import {
	createMediaService,
	validateFileSignature,
} from "../services/media-service";
import { createPresetService } from "../services/preset-service";

describe("shared application services", () => {
	it("rejects duplicate preset names", async () => {
		const preset: Preset = {
			id: 1,
			name: "default",
			value: { type: "group", operator: "and", children: [] },
			createdAt: new Date(),
		};
		const repository: PresetRepository = {
			list: vi.fn(async () => [preset]),
			get: vi.fn(async () => preset),
			getByName: vi.fn(async () => preset),
			create: vi.fn(async () => preset),
			update: vi.fn(async () => preset),
			delete: vi.fn(async () => true),
		};

		const service = createPresetService(repository);

		await expect(
			service.create({
				name: "default",
				value: { type: "group", operator: "and", children: [] },
			}),
		).rejects.toThrow(ResourceConflictError);
	});

	it("links character IPs when adding a character to media", async () => {
		const tx = Symbol("tx") as Transaction;
		const character: Character = {
			id: "00000000-0000-0000-0000-000000000001",
			name: "Character",
			description: "",
			ips: [{ id: "00000000-0000-0000-0000-000000000002", name: "IP" }],
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const characterRepository: CharacterRepository = {
			findAll: vi.fn(async () => [character]),
			findById: vi.fn(async () => character),
			findByName: vi.fn(async () => character),
			findByNames: vi.fn(async () => [character]),
			create: vi.fn(async () => character),
			update: vi.fn(async () => character),
			delete: vi.fn(async () => undefined),
			findByMediaId: vi.fn(async () => [character]),
			getMediaCharacters: vi.fn(async () => []),
			addToMedia: vi.fn(async () => undefined),
			removeFromMedia: vi.fn(async () => undefined),
			addToMediaBulk: vi.fn(async () => undefined),
			findOrCreateBulk: vi.fn(async () => [character]),
			updateIpsBulk: vi.fn(async () => undefined),
		};
		const ipRepository: IIpRepository = {
			findAll: vi.fn(async () => []),
			findById: vi.fn(async () => null),
			findByName: vi.fn(async () => null),
			findByNames: vi.fn(async () => []),
			create: vi.fn(async () => {
				throw new Error("not used");
			}),
			update: vi.fn(async () => {
				throw new Error("not used");
			}),
			delete: vi.fn(async () => undefined),
			findByMediaId: vi.fn(async () => []),
			getMediaIps: vi.fn(async () => []),
			addMedia: vi.fn(async () => undefined),
			removeMedia: vi.fn(async () => undefined),
			addMediaBulk: vi.fn(async () => undefined),
			findOrCreateBulk: vi.fn(async () => []),
		};
		const service = createCharacterService({
			characterRepository,
			ipRepository,
			transactionManager: {
				async transaction<T>(callback: (nextTx: Transaction) => Promise<T>) {
					return await callback(tx);
				},
			},
		});

		await service.addToMedia(
			"00000000-0000-0000-0000-000000000003",
			character.id,
		);

		expect(characterRepository.addToMedia).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000003",
			character.id,
			undefined,
			undefined,
			tx,
		);
		expect(ipRepository.addMedia).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000003",
			"00000000-0000-0000-0000-000000000002",
			undefined,
			"character_link",
			tx,
		);
	});

	it("uses default media processing steps and queues process jobs", async () => {
		const jobRepo = {
			create: vi.fn(async () => ({})),
		};

		expect(hasMediaProcessingStep(undefined, "extractMetadata")).toBe(true);

		await queueMediaProcessingJob({
			jobRepo,
			mediaId: "media-id",
			mediaSourceId: "source-id",
			sourcePath: "/source",
		});

		expect(jobRepo.create).toHaveBeenCalledWith({
			type: "processMedia",
			mediaSourceId: "source-id",
			payload: {
				mediaId: "media-id",
				sourcePath: "/source",
				steps: undefined,
				type: "processMedia",
			},
		});
	});

	it("reads only sliced header bytes during signature validation", async () => {
		const slice = vi.fn(() => ({
			arrayBuffer: vi.fn(
				async () =>
					new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			),
		}));
		const file = {
			name: "image.png",
			arrayBuffer: vi.fn(async () => {
				throw new Error("full file read should not be used");
			}),
			slice,
		};

		await validateFileSignature(file, "image.png");

		expect(slice).toHaveBeenCalledWith(0, 12);
		expect(file.arrayBuffer).not.toHaveBeenCalled();
	});

	it("rolls back saved upload when post-register hook fails", async () => {
		const sourceId = "00000000-0000-4000-8000-000000000001";
		const mediaId = "00000000-0000-4000-8000-000000000002";
		const now = new Date();
		const media: Media = {
			id: mediaId,
			mediaSourceId: sourceId,
			filePath: "image.png",
			fileName: "image.png",
			mediaType: "image",
			width: 1,
			height: 1,
			fileSize: 8,
			description: null,
			createdAt: now,
			modifiedAt: now,
			indexedAt: now,
			status: "active",
		};
		const mediaRepository = {
			findById: vi.fn(async () => media),
			findByPath: vi.fn(async () => null),
			create: vi.fn(async () => media),
			upsert: vi.fn(async () => media),
			update: vi.fn(async () => media),
			delete: vi.fn(async () => undefined),
			search: vi.fn(async () => ({ media: [], total: 0 })),
			globalSearch: vi.fn(async () => ({
				media: [],
				total: 0,
			})),
			getDetails: vi.fn(async () => null),
			getTags: vi.fn(async () => []),
			getGenerationInfo: vi.fn(async () => null),
			getAuthors: vi.fn(async () => []),
			getUrls: vi.fn(async () => []),
			addUrls: vi.fn(async () => []),
			upsertGenerationInfo: vi.fn(async () => {
				throw new Error("not used");
			}),
			findAllBySourceId: vi.fn(async () => []),
			searchInDirectory: vi.fn(async () => []),
			findExistingUrls: vi.fn(async () => []),
			findIdsWithMissingGenerationInfo: vi.fn(async () => []),
			findAllMediaIndices: vi.fn(async () => []),
			findAllPathsBySourceId: vi.fn(async () => []),
		};
		const storageService = {
			saveFile: vi.fn(async () => ({
				filePath: "image.png",
				fileName: "image.png",
				width: 1,
				height: 1,
				size: 8,
				createdAt: now,
				modifiedAt: now,
			})),
			deleteFile: vi.fn(async () => undefined),
			getFile: vi.fn(async () => new Uint8Array()),
			scanDirectory: vi.fn(async () => []),
			getFileMetadata: vi.fn(async () => ({
				width: 1,
				height: 1,
				size: 8,
				createdAt: now,
				modifiedAt: now,
			})),
			copyFile: vi.fn(async () => {
				throw new Error("not used");
			}),
		};
		const hookError = new Error("metadata failed");
		const service = createMediaService({
			mediaRepository,
			sourceRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => ({
					id: sourceId,
					name: "local",
					description: null,
					type: "local" as const,
					connectionInfo: { path: "/media" },
					createdAt: now,
					updatedAt: now,
				})),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
			},
			storageService,
			tagRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => null),
				findByName: vi.fn(async () => null),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
				findByMediaId: vi.fn(async () => []),
				addTagsToMedia: vi.fn(async () => undefined),
			},
			imageProcessor: {
				generateThumbnail: vi.fn(async () => undefined),
				extractMetadata: vi.fn(async () => ({
					tags: [],
					prompt: null,
					workflow: null,
				})),
				getDimensions: vi.fn(async () => ({ width: 1, height: 1 })),
			},
			authorRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => null),
				findByName: vi.fn(async () => null),
				findByNames: vi.fn(async () => []),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
				findByMediaId: vi.fn(async () => []),
				addMedia: vi.fn(async () => undefined),
				addMediaBulk: vi.fn(async () => undefined),
				removeMedia: vi.fn(async () => undefined),
				findOrCreateBulk: vi.fn(async () => []),
			},
			projectRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => null),
				findByName: vi.fn(async () => null),
				findByNames: vi.fn(async () => []),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
				findByMediaId: vi.fn(async () => []),
				addMedia: vi.fn(async () => undefined),
				removeMedia: vi.fn(async () => undefined),
				addMediaBulk: vi.fn(async () => undefined),
				findOrCreateBulk: vi.fn(async () => []),
			},
			characterRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => null),
				findByName: vi.fn(async () => null),
				findByNames: vi.fn(async () => []),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
				findByMediaId: vi.fn(async () => []),
				getMediaCharacters: vi.fn(async () => []),
				addToMedia: vi.fn(async () => undefined),
				removeFromMedia: vi.fn(async () => undefined),
				addToMediaBulk: vi.fn(async () => undefined),
				findOrCreateBulk: vi.fn(async () => []),
				updateIpsBulk: vi.fn(async () => undefined),
			},
			ipRepository: {
				findAll: vi.fn(async () => []),
				findById: vi.fn(async () => null),
				findByName: vi.fn(async () => null),
				findByNames: vi.fn(async () => []),
				create: vi.fn(async () => {
					throw new Error("not used");
				}),
				update: vi.fn(async () => {
					throw new Error("not used");
				}),
				delete: vi.fn(async () => undefined),
				findByMediaId: vi.fn(async () => []),
				getMediaIps: vi.fn(async () => []),
				addMedia: vi.fn(async () => undefined),
				removeMedia: vi.fn(async () => undefined),
				addMediaBulk: vi.fn(async () => undefined),
				findOrCreateBulk: vi.fn(async () => []),
			},
			transactionManager: {
				async transaction<T>(callback: (tx: Transaction) => Promise<T>) {
					return await callback(Symbol("tx") as Transaction);
				},
			},
			contextMetadataUpdater: vi.fn(async () => undefined),
			afterMediaRegistered: vi.fn(async () => {
				throw hookError;
			}),
		});

		await expect(
			service.uploadMedia(
				sourceId,
				{
					name: "image.png",
					arrayBuffer: vi.fn(
						async () =>
							new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
					),
				},
				{ filename: "image.png" },
			),
		).rejects.toThrow(hookError);
		expect(mediaRepository.delete).toHaveBeenCalledWith(mediaId);
		expect(storageService.deleteFile).toHaveBeenCalledWith(
			"/media",
			"image.png",
		);
	});
});

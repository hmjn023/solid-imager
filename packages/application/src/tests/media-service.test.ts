import {
	createMediaService,
	type IMediaService,
} from "@solid-imager/application/media";
import type { IMediaStorage, IImageProcessor } from "@solid-imager/core/ports";
import type { MediaDetails, IMediaRepository } from "@solid-imager/core/media";
import type { IAuthorRepository } from "@solid-imager/core/authors";
import type { CharacterRepository } from "@solid-imager/core/characters";
import type { IIpRepository } from "@solid-imager/core/ips";
import type { IJobRepository } from "@solid-imager/core/jobs";
import type { IProjectRepository } from "@solid-imager/core/projects";
import type { SourceRepository } from "@solid-imager/core/sources";
import type { TagRepository } from "@solid-imager/core/tags";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
const MEDIA_NOT_FOUND_REGEX = /media.*not found/i;

describe("MediaService Unit Tests", () => {
	let mediaService: IMediaService;
	let mockMediaRepository: IMediaRepository;
	let mockSourceRepository: SourceRepository;
	let mockStorageService: IMediaStorage;
	let mockTagRepository: TagRepository;
	let mockImageProcessor: IImageProcessor;
	let mockAuthorRepository: IAuthorRepository;
	let mockProjectRepository: IProjectRepository;
	let mockCharacterRepository: CharacterRepository;
	let mockIpRepository: IIpRepository;
	let mockJobRepository: IJobRepository;
	const mediaContextProcessor = { addContextMetadataToExistingMedia: vi.fn() };

	beforeEach(() => {
		vi.resetAllMocks();
		mockJobRepository = {
			create: vi.fn(),
			createIfUnique: vi.fn(),
			findById: vi.fn(),
			findPending: vi.fn(),
			claimPending: vi.fn(),
			requeueStaleInProgress: vi.fn(),
			markAsInProgress: vi.fn(),
			markAsCompleted: vi.fn(),
			markAsFailed: vi.fn(),
			requestCancellation: vi.fn(),
			markAsCancelled: vi.fn(),
			isCancellationRequested: vi.fn(),
			setArtifact: vi.fn(),
			update: vi.fn(),
			incrementProgress: vi.fn(),
			incrementFailedCount: vi.fn(),
		};

		// Create mocks for all dependencies
		mockMediaRepository = {
			findById: vi.fn(),
			findByPath: vi.fn(),
			create: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			updateConfig: vi.fn(),
			delete: vi.fn(),
			search: vi.fn(),
			findAllBySourceId: vi.fn(),
			searchInDirectory: vi.fn(),
			getTags: vi.fn(),
			getGenerationInfo: vi.fn(),
			getAuthors: vi.fn(),
			getUrls: vi.fn(),
			addUrls: vi.fn(),
			upsertGenerationInfo: vi.fn(),
			getDetails: vi.fn(),
			findAllPathsBySourceId: vi.fn(),
			findDuplicates: vi.fn(),
		} as unknown as IMediaRepository;

		mockSourceRepository = {
			findById: vi.fn(),
		} as unknown as SourceRepository;

		mockStorageService = {
			getFileStats: vi.fn(),
			saveFile: vi.fn(),
			getFile: vi.fn(),
			scanDirectory: vi.fn(),
			getFileMetadata: vi.fn(),
			copyFile: vi.fn(),
			deleteFile: vi.fn(),
		} as unknown as IMediaStorage;

		mockTagRepository = {
			addTagsToMedia: vi.fn(),
		} as unknown as TagRepository;

		mockImageProcessor = {
			extractMetadata: vi.fn(),
		} as unknown as IImageProcessor;

		mockAuthorRepository = {
			create: vi.fn(),
			addMedia: vi.fn(),
		} as unknown as IAuthorRepository;

		mockProjectRepository = {
			findByMediaId: vi.fn(),
			addMedia: vi.fn(),
		} as unknown as IProjectRepository;

		mockCharacterRepository = {
			findByMediaId: vi.fn(),
			addToMedia: vi.fn(),
		} as unknown as CharacterRepository;

		mockIpRepository = {
			findByMediaId: vi.fn(),
			addMedia: vi.fn(),
		} as unknown as IIpRepository;

		mediaService = createMediaService({
			mediaRepository: mockMediaRepository,
			sourceRepository: mockSourceRepository,
			tagRepository: mockTagRepository,
			jobRepository: mockJobRepository,
			authorRepository: mockAuthorRepository,
			projectRepository: mockProjectRepository,
			characterRepository: mockCharacterRepository,
			ipRepository: mockIpRepository,
			storage: mockStorageService,
			imageProcessor: mockImageProcessor,
			transactionManager: { transaction: (callback) => callback("mock-tx") },
			eventPublisher: { publishSource: vi.fn(), notifyMediaCopied: vi.fn() },
			thumbnailManager: { deleteThumbnail: vi.fn() },
			logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
			deferredActionExecutor: { execute: vi.fn() },
			mediaContextProcessor,
		});
	});

	describe("getMediaDetails", () => {
		it("should return media details when found", async () => {
			const mediaId = "123e4567-e89b-42d3-a456-426614174000";
			const sourceId = "123e4567-e89b-42d3-a456-426614174001";
			const mockMedia: MediaDetails = {
				activity: {
					rating: 0,
					favorite: false,
					viewCount: 0,
					lastViewedAt: null,
				},
				id: mediaId,
				mediaSourceId: sourceId,
				filePath: "/path/to/image.png",
				fileName: "image.png",
				mediaType: "image",
				width: 800,
				height: 600,
				fileSize: 1024,
				description: null,
				status: "active",
				createdAt: new Date(),
				modifiedAt: new Date(),
				indexedAt: new Date(),
				tags: [],
				generationInfo: null,
				authors: [],
				urls: [],
				characters: [],
				ips: [],
			};

			(mockMediaRepository.getDetails as Mock).mockResolvedValue(mockMedia);

			const result = await mediaService.getMediaDetails(sourceId, mediaId);

			expect(mockMediaRepository.getDetails).toHaveBeenCalledWith(mediaId);
			expect(result).toBeDefined();
			expect(result.id).toBe(mediaId);
		});

		it("should throw error if media not found", async () => {
			const mediaId = "123e4567-e89b-42d3-a456-426614174999";
			const sourceId = "123e4567-e89b-42d3-a456-426614174888";
			(mockMediaRepository.getDetails as Mock).mockResolvedValue(null);

			await expect(
				mediaService.getMediaDetails(sourceId, mediaId),
			).rejects.toThrow(MEDIA_NOT_FOUND_REGEX);
		});
	});

	describe("uploadMedia", () => {
		it("should successfully upload and register media", async () => {
			const sourceId = "123e4567-e89b-42d3-a456-426614174001";
			const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
			const file = new File([pngSignature], "test.png", { type: "image/png" });
			const options = {
				filename: "custom.png",
				description: "Test description",
				overwrite: true,
				autoIncrement: false,
			};

			const mockSource = {
				id: sourceId,
				type: "local",
				connectionInfo: { path: "/root" },
			};

			const mockFileInfo = {
				filePath: "custom.png",
				fileName: "custom.png",
				width: 100,
				height: 100,
				size: 4,
				createdAt: new Date(),
				modifiedAt: new Date(),
			};

			const mockMedia = {
				id: "new-media-id",
				...mockFileInfo,
				mediaSourceId: sourceId,
				mediaType: "image",
			};

			(mockSourceRepository.findById as Mock).mockResolvedValue(
				mockSource as any,
			);
			(mockStorageService.saveFile as Mock).mockResolvedValue(
				mockFileInfo as any,
			);
			(mockMediaRepository.upsert as Mock).mockResolvedValue(mockMedia as any);

			const result = await mediaService.uploadMedia(sourceId, file, options);

			expect(result.success).toBe(true);
			expect(mockStorageService.saveFile).toHaveBeenCalledWith(
				"/root",
				file,
				expect.objectContaining({
					filename: "custom.png",
					overwrite: true,
				}),
			);
			expect(mockMediaRepository.upsert).toHaveBeenCalled();
			expect(mockJobRepository.createIfUnique).not.toHaveBeenCalled();
		});
	});

	describe("updateMedia", () => {
		it("should update media and call MediaProcessingService for characters/ips", async () => {
			const mediaId = "123e4567-e89b-42d3-a456-426614174000";
			const sourceId = "123e4567-e89b-42d3-a456-426614174001";
			const updates = {
				description: "Updated desc",
				characters: [{ name: "Char 1", confidence: 0.8 }],
				ips: [{ name: "IP 1" }],
			};

			(mockMediaRepository.findById as Mock).mockResolvedValue({
				id: mediaId,
				mediaSourceId: sourceId,
			});
			(mockMediaRepository.update as Mock).mockResolvedValue({ id: mediaId });

			await mediaService.updateMedia(sourceId, mediaId, updates);

			expect(mockMediaRepository.update).toHaveBeenCalledWith(
				mediaId,
				expect.objectContaining({ description: "Updated desc" }),
				expect.anything(),
			);

			expect(
				mediaContextProcessor.addContextMetadataToExistingMedia,
			).toHaveBeenCalledWith(
				mediaId,
				{
					characters: updates.characters,
					ips: updates.ips,
				},
				"mock-tx",
			);
		});
	});
});

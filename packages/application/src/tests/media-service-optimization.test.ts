import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createMediaService } from "../services/media-service";

describe("MediaService Optimization", () => {
	const sourceId = "00000000-0000-4000-8000-000000000001";
	const now = new Date();

	const mockMediaRepository: any = {
		findAllPathsBySourceId: vi.fn(),
		batchUpsert: vi.fn(),
	};

	const mockStorageService: any = {
		scanDirectory: vi.fn(),
		getFileMetadata: vi.fn(),
	};

	const mockSourceRepository: any = {
		findById: vi.fn(),
	};

	const mockJobRepository: any = {
		create: vi.fn(),
		createIfUnique: vi.fn(),
	};

	const deps: any = {
		mediaRepository: mockMediaRepository,
		sourceRepository: mockSourceRepository,
		storageService: mockStorageService,
		jobRepository: mockJobRepository,
		tagRepository: {},
		imageProcessor: {},
		authorRepository: {},
		projectRepository: {},
		characterRepository: {},
		ipRepository: {},
		transactionManager: {},
		contextMetadataUpdater: vi.fn(),
		pathAdapter: undefined,
		logger: {
			info: vi.fn(),
			error: vi.fn(),
		},
	};

	const service = createMediaService(deps);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should process existing media efficiently using batch lookup and batch upsert", async () => {
		// Setup
		const directoryPath = "/media";
		const existingFiles = ["existing.png"];
		const newFiles = ["new1.png", "new2.png"];
		const allFiles = [...existingFiles, ...newFiles].map((f) => `${directoryPath}/${f}`);

		mockStorageService.scanDirectory.mockResolvedValue(allFiles);
		mockSourceRepository.findById.mockResolvedValue({
			id: sourceId,
			name: "local",
			description: null,
			type: "local",
			connectionInfo: { path: directoryPath },
			createdAt: now,
			updatedAt: now,
		});
		mockMediaRepository.findAllPathsBySourceId.mockResolvedValue([
			{ id: "id-existing", filePath: "existing.png" },
		]);

		mockStorageService.getFileMetadata.mockResolvedValue({
			width: 100,
			height: 100,
			size: 1024,
			createdAt: now,
			modifiedAt: now,
		});

		mockMediaRepository.batchUpsert.mockResolvedValue([
			{ id: "id-new1", filePath: "new1.png" },
			{ id: "id-new2", filePath: "new2.png" },
		]);

		// Execute
		await service.registerExistingMedia(sourceId, directoryPath);

		// Verify
		// 1. scanDirectory was called
		expect(mockStorageService.scanDirectory).toHaveBeenCalledWith(directoryPath);

		// 2. findAllPathsBySourceId was called (Batch lookup)
		expect(mockMediaRepository.findAllPathsBySourceId).toHaveBeenCalledWith(sourceId);

		// 3. getFileMetadata was called ONLY for new files
		expect(mockStorageService.getFileMetadata).toHaveBeenCalledTimes(2);
		expect(mockStorageService.getFileMetadata).not.toHaveBeenCalledWith(
			`${directoryPath}/existing.png`,
		);

		// 4. batchUpsert was called (instead of multiple upserts)
		expect(mockMediaRepository.batchUpsert).toHaveBeenCalledTimes(1);
		const batchInput = mockMediaRepository.batchUpsert.mock.calls[0][0];
		expect(batchInput).toHaveLength(2);
		expect(batchInput[0].filePath).toBe("new1.png");
		expect(batchInput[1].filePath).toBe("new2.png");

		// 5. Jobs were queued for new items
		expect(mockJobRepository.create).toHaveBeenCalledTimes(2);
	});
});

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";

// Mock Repositories
const mockMediaRepo = {
	findById: vi.fn(),
	update: vi.fn(),
	addUrls: vi.fn(),
	upsertGenerationInfo: vi.fn(),
};
const mockTagRepo = {
	addTagsToMedia: vi.fn(),
};
const mockAuthorRepo = {
	create: vi.fn(),
	addMedia: vi.fn(),
	findByName: vi.fn(),
	findOrCreateBulk: vi.fn(),
	addMediaBulk: vi.fn(),
};
const mockCharacterRepo = {
	create: vi.fn(),
	addToMedia: vi.fn(),
	findByName: vi.fn(),
	findById: vi.fn(),
	update: vi.fn(),
	findByNames: vi.fn(),
	findOrCreateBulk: vi.fn(),
	updateIpsBulk: vi.fn(),
	addToMediaBulk: vi.fn(),
};
const mockCharacterService = {
	findByName: vi.fn(),
	createCharacter: vi.fn(),
	updateCharacter: vi.fn(),
	addCharacterToMedia: vi.fn(),
	linkCharacterIps: vi.fn(),
	characterRepo: mockCharacterRepo,
};
const mockIpRepo = {
	create: vi.fn(),
	addMedia: vi.fn(),
	findByName: vi.fn(),
	findByNames: vi.fn(),
	findOrCreateBulk: vi.fn(),
	addMediaBulk: vi.fn(),
};
const mockProjectRepo = {
	create: vi.fn(),
	addMedia: vi.fn(),
	findByName: vi.fn(),
	findOrCreateBulk: vi.fn(),
	addMediaBulk: vi.fn(),
};
const mockJobRepo = {
	create: vi.fn(),
};

const mockConfigService = {
	getConfig: vi.fn().mockReturnValue({
		jobs: {
			concurrency: 3,
			pollIntervalMs: 1000,
			enableAutoTagging: false,
		},
		media: {
			supportedExtensions: {
				image: [".jpg", ".jpeg", ".png", ".webp"],
				video: [".mp4", ".webm", ".mov"],
				audio: [".mp3", ".wav"],
			},
		},
	}),
	onChange: vi.fn(),
};

describe("MediaProcessingService", () => {
	let service: MediaProcessingServiceImpl;

	beforeEach(() => {
		service = new MediaProcessingServiceImpl(
			{} as any, // SourceRepo
			mockMediaRepo as any,
			mockTagRepo as any,
			mockAuthorRepo as any,
			mockCharacterService as any,
			mockIpRepo as any,
			mockProjectRepo as any,
			mockJobRepo as any,
			mockConfigService as any,
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("addContextMetadataToExistingMedia", () => {
		const mediaId = "test-media-id";

		it("should update description if provided", async () => {
			mockMediaRepo.findById.mockResolvedValue({ id: mediaId });

			await service.addContextMetadataToExistingMedia(mediaId, {
				description: "New Description",
			});

			expect(mockMediaRepo.update).toHaveBeenCalledWith(
				mediaId,
				{
					description: "New Description",
				},
				undefined,
			);
		});

		it("should register authors if provided", async () => {
			mockMediaRepo.findById.mockResolvedValue({ id: mediaId });
			mockAuthorRepo.findOrCreateBulk.mockResolvedValue([
				{ id: "author-id", name: "Author Name" },
			]);

			await service.addContextMetadataToExistingMedia(mediaId, {
				authors: [{ name: "Author Name", accountId: "acc-123" }],
			});

			expect(mockAuthorRepo.findOrCreateBulk).toHaveBeenCalledWith(
				["Author Name"],
				undefined,
			);
			expect(mockAuthorRepo.addMediaBulk).toHaveBeenCalledWith(
				mediaId,
				["author-id"],
				undefined,
			);
		});

		it("should register characters and auto-assign their IPs if provided", async () => {
			const charId = "char-1";
			const ipId = "ip-1";
			const testConfidence = 0.9;
			mockMediaRepo.findById.mockResolvedValue({ id: mediaId });
			mockIpRepo.findByNames.mockResolvedValue([{ id: ipId, name: "IP Name" }]);

			// Steps in registerCharacters
			mockCharacterRepo.findByNames.mockResolvedValue([]);
			mockCharacterRepo.findOrCreateBulk.mockResolvedValue([
				{
					id: charId,
					name: "Char Name",
					ips: [{ id: ipId, name: "IP Name" }],
				},
			]);

			await service.addContextMetadataToExistingMedia(mediaId, {
				characters: [{ name: "Char Name", confidence: testConfidence }],
			});

			expect(mockCharacterRepo.findByNames).toHaveBeenCalledWith(
				["Char Name"],
				undefined,
			);
			expect(mockCharacterRepo.findOrCreateBulk).toHaveBeenCalledWith(
				[{ name: "Char Name", ipIds: [] }],
				"manual",
				undefined,
			);
			expect(mockCharacterRepo.addToMediaBulk).toHaveBeenCalledWith(
				mediaId,
				[{ id: charId, confidence: testConfidence }],
				"manual",
				undefined,
			);
			expect(mockIpRepo.addMediaBulk).toHaveBeenCalledWith(
				mediaId,
				[{ id: ipId }],
				"character_link",
				undefined,
			);
		});

		it("should link new character to new IP if both are in the same context", async () => {
			const charName = "New Char";
			const ipName = "New IP";
			const ipId = "new-ip-id";
			const charId = "new-char-id";

			mockMediaRepo.findById.mockResolvedValue({ id: mediaId });

			// 1. IP registration
			mockIpRepo.findOrCreateBulk.mockResolvedValue([
				{ id: ipId, name: ipName },
			]);
			mockIpRepo.findByNames.mockResolvedValue([{ id: ipId, name: ipName }]);

			// 2. Character registration
			mockCharacterRepo.findByNames.mockResolvedValue([]);
			mockCharacterRepo.findOrCreateBulk.mockResolvedValue([
				{
					id: charId,
					name: charName,
					ips: [{ id: ipId, name: ipName }],
				},
			]);

			await service.addContextMetadataToExistingMedia(mediaId, {
				characters: [{ name: charName }],
				ips: [{ name: ipName }],
			});

			// Verify IP was created bulk
			expect(mockIpRepo.findOrCreateBulk).toHaveBeenCalledWith(
				[ipName],
				"manual",
				undefined,
			);

			// Verify Character was created bulk with IP ID
			expect(mockCharacterRepo.findOrCreateBulk).toHaveBeenCalledWith(
				[{ name: charName, ipIds: [ipId] }],
				"manual",
				undefined,
			);
		});

		it("should throw error if media not found", async () => {
			mockMediaRepo.findById.mockResolvedValue(null);

			await expect(
				service.addContextMetadataToExistingMedia(mediaId, {
					description: "desc",
				}),
			).rejects.toThrow("Media not found");
		});
	});
});

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockCreateORPCClient = vi.fn();
const mockDetectDiffs = vi.fn();
const mockResolveConflict = vi.fn();
const mockGetDriver = vi.fn();

vi.mock("@orpc/client", () => ({
	createORPCClient: mockCreateORPCClient,
}));

vi.mock("@orpc/client/fetch", () => ({
	RPCLink: class RPCLink {},
}));

vi.mock("@solid-imager/core/domain/media/conflict-resolution", () => ({
	ConflictResolverService: class ConflictResolverService {
		resolveConflict = mockResolveConflict;
	},
}));

vi.mock("~/application/services/diff-detector-service", () => ({
	DiffDetectorServiceImpl: class DiffDetectorServiceImpl {
		detectDiffs = mockDetectDiffs;
	},
}));

vi.mock("~/infrastructure/storage/factory", () => ({
	getDriver: mockGetDriver,
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
	},
}));

describe("BidirectionalSyncServiceImpl", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses remote source ID from connection info when listing remote media", async () => {
		const remoteClient = {
			media: {
				search: vi.fn().mockResolvedValue({
					media: [],
					total: 0,
				}),
			},
		};
		mockCreateORPCClient.mockReturnValue(remoteClient);
		mockDetectDiffs.mockResolvedValue({
			localOnly: [],
			remoteOnly: [],
			conflicts: [],
			identical: [],
		});

		const mediaRepository = {};
		const sourceRepository = {
			findById: vi.fn().mockResolvedValue({
				id: "11111111-1111-4111-8111-111111111111",
				connectionInfo: {
					url: "http://remote.example.com:3000",
					remoteSourceId: "22222222-2222-4222-8222-222222222222",
				},
			}),
		};

		const { BidirectionalSyncServiceImpl } = await import(
			"~/application/services/bidirectional-sync-service"
		);
		const service = new BidirectionalSyncServiceImpl(
			mediaRepository as any,
			sourceRepository as any,
		);

		await service.sync({
			localSourceId: "33333333-3333-4333-8333-333333333333",
			remoteSourceId: "11111111-1111-4111-8111-111111111111",
			direction: "bidirectional",
			conflictResolution: "newer_wins",
			dryRun: true,
		});

		expect(remoteClient.media.search).toHaveBeenCalledWith({
			sourceId: "22222222-2222-4222-8222-222222222222",
			params: { limit: 100, offset: 0 },
		});
	});

	it("pushes local media to remote source ID resolved from connection info", async () => {
		const remoteClient = {
			media: {
				search: vi.fn().mockResolvedValue({
					media: [],
					total: 0,
				}),
			},
			sync: {
				pushMediaFile: vi.fn().mockResolvedValue({ success: true }),
			},
		};
		mockCreateORPCClient.mockReturnValue(remoteClient);
		mockDetectDiffs.mockResolvedValue({
			localOnly: [
				{
					mediaId: "44444444-4444-4444-8444-444444444444",
					filePath: "folder/local.png",
					hashMd5: null,
					modifiedAt: new Date(),
					fileSize: 10,
				},
			],
			remoteOnly: [],
			conflicts: [],
			identical: [],
		});

		mockGetDriver.mockReturnValue({
			get: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		});

		const mediaRepository = {
			findById: vi.fn().mockResolvedValue({
				id: "44444444-4444-4444-8444-444444444444",
				mediaSourceId: "55555555-5555-4555-8555-555555555555",
				filePath: "folder/local.png",
				fileName: "local.png",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
			getDetails: vi.fn().mockResolvedValue({
				description: "desc",
				urls: [],
				authors: [],
				tags: [],
				characters: [],
				ips: [],
				generationInfo: null,
			}),
		};
		const sourceRepository = {
			findById: vi.fn(async (id: string) => {
				if (id === "11111111-1111-4111-8111-111111111111") {
					return {
						id,
						connectionInfo: {
							url: "http://remote.example.com:3000",
							remoteSourceId: "22222222-2222-4222-8222-222222222222",
						},
					};
				}
				if (id === "55555555-5555-4555-8555-555555555555") {
					return {
						id,
						type: "local",
						connectionInfo: { path: "/tmp/local-source" },
					};
				}
				return null;
			}),
		};

		const { BidirectionalSyncServiceImpl } = await import(
			"~/application/services/bidirectional-sync-service"
		);
		const service = new BidirectionalSyncServiceImpl(
			mediaRepository as any,
			sourceRepository as any,
		);

		await service.sync({
			localSourceId: "33333333-3333-4333-8333-333333333333",
			remoteSourceId: "11111111-1111-4111-8111-111111111111",
			direction: "bidirectional",
			conflictResolution: "newer_wins",
			dryRun: false,
		});

		expect(remoteClient.sync.pushMediaFile).toHaveBeenCalledWith(
			expect.objectContaining({
				targetSourceId: "22222222-2222-4222-8222-222222222222",
			}),
		);
	});

	it("uses remote source ID from connection info for merged conflict details lookup", async () => {
		const remoteClient = {
			media: {
				search: vi.fn().mockResolvedValue({
					media: [],
					total: 0,
				}),
				getDetails: vi.fn().mockResolvedValue({
					fileName: "remote.png",
					tags: [{ name: "tag-a", type: "positive", confidence: 1 }],
					authors: [{ name: "author-a", accountId: null }],
					characters: [{ name: "char-a", confidence: 1 }],
					ips: [{ name: "ip-a", confidence: 1 }],
				}),
			},
			sync: {
				pushMediaFile: vi.fn().mockResolvedValue({ success: true }),
			},
		};
		mockCreateORPCClient.mockReturnValue(remoteClient);
		mockDetectDiffs.mockResolvedValue({
			localOnly: [],
			remoteOnly: [],
			conflicts: [
				{
					local: {
						mediaId: "44444444-4444-4444-8444-444444444444",
						filePath: "folder/local.png",
						hashMd5: "aaa",
						modifiedAt: new Date(),
						fileSize: 10,
					},
					remote: {
						mediaId: "66666666-6666-4666-8666-666666666666",
						filePath: "folder/local.png",
						hashMd5: "bbb",
						modifiedAt: new Date(),
						fileSize: 10,
					},
					difference: "hash",
				},
			],
			identical: [],
		});
		mockResolveConflict.mockReturnValue({
			success: true,
			action: "merged",
			conflict: {
				localMediaId: "44444444-4444-4444-8444-444444444444",
				remoteMediaId: "66666666-6666-4666-8666-666666666666",
			},
		});
		mockGetDriver.mockReturnValue({
			get: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		});

		const mediaRepository = {
			findById: vi.fn().mockResolvedValue({
				id: "44444444-4444-4444-8444-444444444444",
				mediaSourceId: "55555555-5555-4555-8555-555555555555",
				filePath: "folder/local.png",
				fileName: "local.png",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
			getDetails: vi.fn().mockResolvedValue({
				description: "desc",
				urls: [],
				authors: [{ name: "author-local", accountId: null }],
				tags: [{ name: "tag-local", type: "positive", confidence: 1 }],
				characters: [{ name: "char-local", confidence: 1 }],
				ips: [{ name: "ip-local", confidence: 1 }],
				generationInfo: null,
			}),
		};
		const sourceRepository = {
			findById: vi.fn(async (id: string) => {
				if (id === "11111111-1111-4111-8111-111111111111") {
					return {
						id,
						connectionInfo: {
							url: "http://remote.example.com:3000",
							remoteSourceId: "22222222-2222-4222-8222-222222222222",
						},
					};
				}
				if (id === "55555555-5555-4555-8555-555555555555") {
					return {
						id,
						type: "local",
						connectionInfo: { path: "/tmp/local-source" },
					};
				}
				return null;
			}),
		};

		const { BidirectionalSyncServiceImpl } = await import(
			"~/application/services/bidirectional-sync-service"
		);
		const service = new BidirectionalSyncServiceImpl(
			mediaRepository as any,
			sourceRepository as any,
		);

		await service.sync({
			localSourceId: "33333333-3333-4333-8333-333333333333",
			remoteSourceId: "11111111-1111-4111-8111-111111111111",
			direction: "bidirectional",
			conflictResolution: "newer_wins",
			dryRun: false,
		});

		expect(remoteClient.media.getDetails).toHaveBeenCalledWith({
			sourceId: "22222222-2222-4222-8222-222222222222",
			mediaId: "66666666-6666-4666-8666-666666666666",
		});
		expect(remoteClient.sync.pushMediaFile).toHaveBeenCalledWith(
			expect.objectContaining({
				targetSourceId: "22222222-2222-4222-8222-222222222222",
			}),
		);
	});
});

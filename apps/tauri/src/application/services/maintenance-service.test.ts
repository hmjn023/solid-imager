import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MaintenanceService } from "./maintenance-service";

const {
	mockAppDataDir,
	mockIsAbsolute,
	mockJoin,
	mockGetTauriAppServices,
	mockInitialize,
	mockRegisterQueuedSources,
	mockGetConfig,
	mockFindIdsWithMissingGenerationInfo,
	mockFindAllMediaIndices,
	mockFindSourceById,
	mockCreateIfUnique,
} = vi.hoisted(() => ({
	mockAppDataDir: vi.fn(async () => "/app"),
	mockIsAbsolute: vi.fn(async () => false),
	mockJoin: vi.fn(
		async (left: string, right: string) => `${left}/${right}`,
	),
	mockGetTauriAppServices: vi.fn(),
	mockInitialize: vi.fn(async () => undefined),
	mockRegisterQueuedSources: vi.fn(),
	mockGetConfig: vi.fn(),
	mockFindIdsWithMissingGenerationInfo: vi.fn(),
	mockFindAllMediaIndices: vi.fn(),
	mockFindSourceById: vi.fn(),
	mockCreateIfUnique: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
	appDataDir: mockAppDataDir,
	isAbsolute: mockIsAbsolute,
	join: mockJoin,
}));

vi.mock("~/app-services", () => ({
	getTauriAppServices: mockGetTauriAppServices,
}));

vi.mock("~/infrastructure/jobs/tauri-job-queue", () => ({
	tauriJobQueue: {
		initialize: mockInitialize,
		registerQueuedSources: mockRegisterQueuedSources,
	},
}));

vi.mock("~/infrastructure/local-api/repositories/media-repository", () => ({
	TauriMediaRepository: {
		findIdsWithMissingGenerationInfo: mockFindIdsWithMissingGenerationInfo,
		findAllMediaIndices: mockFindAllMediaIndices,
	},
}));

vi.mock("~/infrastructure/local-api/repositories/source-repository", () => ({
	TauriSourceRepository: {
		findById: mockFindSourceById,
	},
}));

vi.mock("~/infrastructure/local-api/repositories/tauri-job-repository", () => ({
	TauriJobRepository: {
		createIfUnique: mockCreateIfUnique,
	},
}));

vi.mock("~/infrastructure/local-api/services/config-service", () => ({
	TauriConfigService: {
		getConfig: mockGetConfig,
	},
}));

describe("Tauri MaintenanceService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetConfig.mockResolvedValue({
			storage: {
				thumbnailDir: "thumbs",
			},
		});
		mockFindIdsWithMissingGenerationInfo.mockResolvedValue([]);
		mockFindAllMediaIndices.mockResolvedValue([]);
		mockFindSourceById.mockResolvedValue(null);
		mockCreateIfUnique.mockResolvedValue(null);
		mockGetTauriAppServices.mockReturnValue({
			fileSystem: {
				exists: vi.fn(async () => false),
				readdir: vi.fn(async () => []),
			},
		});
	});

	it("resolves relative thumbnail paths and registers queued sources", async () => {
		mockFindAllMediaIndices.mockResolvedValueOnce([
			{
				id: "media-1",
				mediaSourceId: "source-1",
				filePath: "one.png",
			},
		]);
		mockFindSourceById.mockResolvedValue({
			id: "source-1",
			type: "local",
			connectionInfo: { path: "/media" },
		});
		mockCreateIfUnique.mockResolvedValue({ id: "job-1" });

		const service = new MaintenanceService();
		await service.performStartupChecks();

		expect(mockJoin).toHaveBeenCalledWith("/app", "thumbs");
		expect(mockJoin).toHaveBeenCalledWith("/app/thumbs", "source-1");
		expect(mockInitialize).toHaveBeenCalledOnce();
		expect(mockRegisterQueuedSources).toHaveBeenCalledWith(["source-1"]);
		expect(mockCreateIfUnique).toHaveBeenCalledWith({
			type: "processMedia",
			mediaSourceId: "source-1",
			payload: {
				mediaId: "media-1",
				sourcePath: "/media",
				steps: ["generateThumbnail"],
				type: "processMedia",
			},
		});
	});
});

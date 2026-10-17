import { describe, expect, it, vi } from "vitest";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
vi.mock("~/infrastructure/services/source-run-service", () => ({
	sourceRunService: { syncMediaSource: vi.fn() },
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getSourceRepository: () => ({
			findAll: async () => [
				{ id: "local", type: "local" },
				{ id: "remote", type: "s3" },
			],
		}),
	},
}));
describe("DirectorySyncService durable facade", () => {
	it("delegates requests to the persistent source workflow", async () => {
		vi.mocked(sourceRunService.syncMediaSource).mockResolvedValue({
			sourceId: "local",
			added: 2,
			deleted: 1,
		});
		expect(await DirectorySyncService.syncMediaSource("local")).toEqual({
			sourceId: "local",
			added: 2,
			deleted: 1,
		});
	});
	it("queues only local sources for startup scans", async () => {
		vi.mocked(sourceRunService.syncMediaSource).mockResolvedValue({
			sourceId: "local",
			added: 0,
			deleted: 0,
		});
		expect(await DirectorySyncService.syncAllLocalSources()).toHaveLength(1);
		expect(sourceRunService.syncMediaSource).toHaveBeenCalledWith("local");
		expect(sourceRunService.syncMediaSource).not.toHaveBeenCalledWith("remote");
	});
});

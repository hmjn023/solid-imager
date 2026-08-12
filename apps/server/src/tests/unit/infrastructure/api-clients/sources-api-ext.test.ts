import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
	orpc: {
		sources: {
			enqueueExport: vi.fn(),
			importZip: vi.fn(),
			restore: vi.fn(),
		},
		jobs: { downloadArtifact: vi.fn(), get: vi.fn() },
	},
	getBaseUrl: vi.fn(() => "/api/rpc"),
}));

import { orpc } from "~/infrastructure/api-clients/orpc-client";

describe("Sources API Client Extensions", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should enqueue and download a completed json export", async () => {
		const id = "test-source-id";
		const mockBlob = new Blob(["dump"], {
			type: "application/json",
		});
		((orpc.sources as any).enqueueExport as any).mockResolvedValue({
			id: "export-job-id",
		});
		((orpc.jobs as any).get as any).mockResolvedValue({
			status: "completed",
			artifact: {
				fileName: "dump.ndjson",
				contentType: "application/x-ndjson",
			},
		});
		((orpc.jobs as any).downloadArtifact as any).mockResolvedValue(
			new Blob([mockBlob]).stream(),
		);

		const result = await fetchSourceDump(id, "json");

		expect((orpc.sources as any).enqueueExport).toHaveBeenCalledWith({
			id,
			mode: "json",
			includeImages: false,
		});
		expect((orpc.jobs as any).get).toHaveBeenCalledWith(
			{ id: "export-job-id" },
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
		expect((orpc.jobs as any).downloadArtifact).toHaveBeenCalledWith(
			{
				id: "export-job-id",
			},
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
		expect(await result.text()).toBe("dump");
	});

	it("should pass the selected mode to export jobs", async () => {
		const id = "test-source-id";
		const mockBlob = new Blob(["zip content"], { type: "application/zip" });
		((orpc.sources as any).enqueueExport as any).mockResolvedValue({
			id: "export-job-id",
		});
		((orpc.jobs as any).get as any).mockResolvedValue({
			status: "completed",
			artifact: { fileName: "dump.tar", contentType: "application/x-tar" },
		});
		((orpc.jobs as any).downloadArtifact as any).mockResolvedValue(
			new Blob([mockBlob]).stream(),
		);

		const result = await fetchSourceDump(id, "zip");

		expect((orpc.sources as any).enqueueExport).toHaveBeenCalledWith({
			id,
			mode: "zip",
			includeImages: false,
		});
		expect(await result.text()).toBe("zip content");
	});

	it("should upload imports through oRPC", async () => {
		const id = "test-source-id";
		const mockFile = new File(["zip content"], "test.zip", {
			type: "application/zip",
		});
		const mockResponse = { importedCount: 1 };
		((orpc.sources as any).importZip as any).mockResolvedValue(mockResponse);

		const result = await importSourceZip(id, mockFile);

		expect((orpc.sources as any).importZip).toHaveBeenCalledWith({
			id,
			file: mockFile,
		});
		expect(result).toEqual(mockResponse);
	});

	it("should call orpc.sources.restore with correct parameters", async () => {
		const id = "test-source-id";
		const data: any[] = [];
		const mockResponse = { processed: 10, skipped: 2 };

		((orpc.sources as any).restore as any).mockResolvedValue(
			mockResponse as any,
		);

		const result = await restoreSource(id, data);

		expect((orpc.sources as any).restore).toHaveBeenCalledWith({
			id,
			data,
		});
		expect(result).toEqual(mockResponse);
	});
});

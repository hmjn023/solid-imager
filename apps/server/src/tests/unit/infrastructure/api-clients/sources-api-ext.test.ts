import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchSourceDump,
	importSourceNdjson,
	importSourceTar,
} from "~/infrastructure/api-clients/sources-api";

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
	orpc: {
		sources: {
			enqueueExport: vi.fn(),
			enqueueImport: vi.fn(),
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

	it("should enqueue and download a completed NDJSON export", async () => {
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

		const result = await fetchSourceDump(id, "ndjson");

		expect((orpc.sources as any).enqueueExport).toHaveBeenCalledWith({
			id,
			mode: "ndjson",
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

	it("should include images by default for TAR exports", async () => {
		const id = "test-source-id";
		const mockBlob = new Blob(["tar content"], { type: "application/x-tar" });
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

		const result = await fetchSourceDump(id, "tar");

		expect((orpc.sources as any).enqueueExport).toHaveBeenCalledWith({
			id,
			mode: "tar",
			includeImages: true,
		});
		expect(await result.text()).toBe("tar content");
	});

	it("should enqueue TAR imports through oRPC", async () => {
		const id = "test-source-id";
		const mockFile = new File(["tar content"], "test.tar", {
			type: "application/x-tar",
		});
		const mockResponse = { id: "restore-job-id" };
		((orpc.sources as any).enqueueImport as any).mockResolvedValue(
			mockResponse,
		);

		const result = await importSourceTar(id, mockFile);

		expect((orpc.sources as any).enqueueImport).toHaveBeenCalledWith({
			id,
			mode: "tar",
			file: mockFile,
		});
		expect(result).toEqual(mockResponse);
	});

	it("should enqueue NDJSON imports through oRPC", async () => {
		const id = "test-source-id";
		const mockFile = new File(["{}\n"], "test.ndjson", {
			type: "application/x-ndjson",
		});
		const mockResponse = { id: "restore-job-id" };
		((orpc.sources as any).enqueueImport as any).mockResolvedValue(
			mockResponse,
		);

		const result = await importSourceNdjson(id, mockFile);

		expect((orpc.sources as any).enqueueImport).toHaveBeenCalledWith({
			id,
			mode: "ndjson",
			file: mockFile,
		});
		expect(result).toEqual(mockResponse);
	});
});

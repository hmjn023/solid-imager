import type { MediaDumpItemWithImageData } from "@solid-imager/application/ports/lancedb-dump-service";
import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
	mockCreateTable,
	mockMergeInsert,
	mockWhenMatchedUpdateAll,
	mockExecute,
	mockOpenTable,
	mockQuery,
	mockLimit,
	mockOffset,
	mockToArray,
	mockOptimize,
} = vi.hoisted(() => ({
	mockCreateTable: vi.fn(),
	mockMergeInsert: vi.fn(),
	mockWhenMatchedUpdateAll: vi.fn(),
	mockExecute: vi.fn(),
	mockOpenTable: vi.fn(),
	mockQuery: vi.fn(),
	mockLimit: vi.fn(),
	mockOffset: vi.fn(),
	mockToArray: vi.fn(),
	mockOptimize: vi.fn(),
}));

function createMockTable() {
	const table = {
		add: vi.fn(),
		mergeInsert: mockMergeInsert,
		optimize: mockOptimize,
		query: mockQuery,
	};

	mockMergeInsert.mockReturnValue({
		whenMatchedUpdateAll: mockWhenMatchedUpdateAll,
	});
	mockWhenMatchedUpdateAll.mockReturnValue({
		execute: mockExecute,
	});

	mockQuery.mockReturnValue({
		limit: mockLimit,
	});
	mockLimit.mockReturnValue({
		offset: mockOffset,
	});
	mockOffset.mockReturnValue({
		toArray: mockToArray,
	});

	return table;
}

function createMockConnect(mockTable: ReturnType<typeof createMockTable>) {
	return vi.fn().mockResolvedValue({
		createTable: mockCreateTable.mockResolvedValue(mockTable),
		openTable: mockOpenTable.mockResolvedValue(mockTable),
	});
}

describe("LanceDB Dump Service", () => {
	let mockTable: ReturnType<typeof createMockTable>;
	let mockConnect: ReturnType<typeof createMockConnect>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockTable = createMockTable();
		mockConnect = createMockConnect(mockTable);
	});

	describe("writeToLanceDB", () => {
		it("should write metadata in Phase 1 and images in Phase 2", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const items: MediaDumpItem[] = [
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
				},
				{
					id: "item-2",
					filePath: "test/image2.png",
					fileName: "image2.png",
					mediaType: "image",
					width: 200,
					height: 200,
					fileSize: 2048,
				},
			];

			const mockImageBuffer1 = Buffer.from("image-data-1");
			const mockImageBuffer2 = Buffer.from("image-data-2");

			const getImageBuffer = vi
				.fn()
				.mockImplementation(async (filePath: string) => {
					if (filePath === "test/image1.png") return mockImageBuffer1;
					if (filePath === "test/image2.png") return mockImageBuffer2;
					return null;
				});

			await service.writeToLanceDB(items, {
				includeImages: true,
				getImageBuffer,
			});

			// Phase 1: createTable should be called with metadata only (no imageData)
			expect(mockCreateTable).toHaveBeenCalledTimes(1);
			const createTableCall = mockCreateTable.mock.calls[0];
			expect(createTableCall[0]).toBe("media");
			const rows = createTableCall[1];
			expect(rows).toHaveLength(2);
			expect(rows[0].id).toBe("item-1");
			expect(rows[0].imageData).toBeNull();
			expect(rows[1].id).toBe("item-2");
			expect(rows[1].imageData).toBeNull();

			// Phase 2: mergeInsert should be called with image data
			expect(mockMergeInsert).toHaveBeenCalledWith("id");
			expect(mockExecute).toHaveBeenCalledTimes(1);
			const executeCall = mockExecute.mock.calls[0];
			const imageRows = executeCall[0];
			expect(imageRows).toHaveLength(2);
			expect(imageRows[0].id).toBe("item-1");
			expect(imageRows[0].imageData).toBe(mockImageBuffer1);
			expect(imageRows[1].id).toBe("item-2");
			expect(imageRows[1].imageData).toBe(mockImageBuffer2);

			// getImageBuffer should be called for each item
			expect(getImageBuffer).toHaveBeenCalledTimes(2);
		});

		it("should skip Phase 2 when includeImages is false", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const items: MediaDumpItem[] = [
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
				},
			];

			const getImageBuffer = vi.fn();

			await service.writeToLanceDB(items, {
				includeImages: false,
				getImageBuffer,
			});

			// Phase 1: createTable should be called
			expect(mockCreateTable).toHaveBeenCalledTimes(1);

			// Phase 2: mergeInsert should NOT be called
			expect(mockMergeInsert).not.toHaveBeenCalled();
			expect(getImageBuffer).not.toHaveBeenCalled();
		});

		it("should handle getImageBuffer errors gracefully", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const items: MediaDumpItem[] = [
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
				},
				{
					id: "item-2",
					filePath: "test/image2.png",
					fileName: "image2.png",
					mediaType: "image",
					width: 200,
					height: 200,
					fileSize: 2048,
				},
			];

			const getImageBuffer = vi
				.fn()
				.mockImplementation(async (filePath: string) => {
					if (filePath === "test/image1.png") {
						throw new Error("File not found");
					}
					return Buffer.from("image-data-2");
				});

			await service.writeToLanceDB(items, {
				includeImages: true,
				getImageBuffer,
			});

			// Phase 2: only successful image should be in mergeInsert
			expect(mockExecute).toHaveBeenCalledTimes(1);
			const executeCall = mockExecute.mock.calls[0];
			const imageRows = executeCall[0];
			expect(imageRows).toHaveLength(1);
			expect(imageRows[0].id).toBe("item-2");
		});
	});

	describe("readFromLanceDB", () => {
		it("should NOT include _imageData when extractImages is false", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const mockImageData = new Uint8Array([1, 2, 3, 4]);
			mockToArray.mockResolvedValue([
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
					imageData: mockImageData,
				},
			]);

			const result = await service.readFromLanceDB("/path/to/lancedb", {
				extractImages: false,
			});

			expect(result).toHaveLength(1);
			const item = result[0] as MediaDumpItemWithImageData;
			expect(item.id).toBe("item-1");
			expect(item.filePath).toBe("test/image1.png");
			expect(item._imageData).toBeUndefined();
		});

		it("should include _imageData when extractImages is true", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const mockImageData = new Uint8Array([1, 2, 3, 4]);
			mockToArray.mockResolvedValue([
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
					imageData: mockImageData,
				},
			]);

			const result = await service.readFromLanceDB("/path/to/lancedb", {
				extractImages: true,
			});

			expect(result).toHaveLength(1);
			const item = result[0] as MediaDumpItemWithImageData;
			expect(item.id).toBe("item-1");
			expect(item._imageData).toBe(mockImageData);
		});

		it("should call saveImageBuffer when extractImages is true", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			const mockImageData = new Uint8Array([1, 2, 3, 4]);
			mockToArray.mockResolvedValue([
				{
					id: "item-1",
					filePath: "test/image1.png",
					fileName: "image1.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
					imageData: mockImageData,
				},
			]);

			const saveImageBuffer = vi.fn().mockResolvedValue(undefined);

			await service.readFromLanceDB("/path/to/lancedb", {
				extractImages: true,
				saveImageBuffer,
			});

			expect(saveImageBuffer).toHaveBeenCalledTimes(1);
			expect(saveImageBuffer).toHaveBeenCalledWith(
				"test/image1.png",
				expect.any(Buffer),
			);
		});

		it("should handle multiple chunks correctly", async () => {
			const { createLanceDbDumpService } = await import(
				"@solid-imager/application/services/lancedb-dump-service"
			);
			const service = createLanceDbDumpService({ connect: mockConnect });

			let callCount = 0;
			mockToArray.mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					return [
						{
							id: "item-1",
							filePath: "test/image1.png",
							fileName: "image1.png",
							mediaType: "image",
							width: 100,
							height: 100,
							fileSize: 1024,
							imageData: new Uint8Array([1]),
						},
					];
				}
				return [];
			});

			const onChunk = vi.fn().mockResolvedValue(undefined);

			await service.readFromLanceDB("/path/to/lancedb", {
				extractImages: false,
				onChunk,
			});

			expect(onChunk).toHaveBeenCalledTimes(1);
			const chunk = onChunk.mock.calls[0][0];
			expect(chunk).toHaveLength(1);
			expect(chunk[0].id).toBe("item-1");
		});
	});
});

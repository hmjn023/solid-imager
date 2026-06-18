import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockCreateTable, mockOpenTable, mockOptimize } = vi.hoisted(() => ({
	mockCreateTable: vi.fn(),
	mockOpenTable: vi.fn(),
	mockOptimize: vi.fn(),
}));

function createTable(rows: Record<string, unknown>[] = []) {
	return {
		add: vi.fn(async (newRows: Record<string, unknown>[]) =>
			rows.push(...newRows),
		),
		delete: vi.fn(),
		optimize: mockOptimize,
		query: vi.fn(() => ({
			limit: (limit: number) => ({
				offset: (offset: number) => ({
					toArray: async () => rows.slice(offset, offset + limit),
				}),
			}),
			where: () => ({
				toArray: async () => rows,
			}),
		})),
	};
}

function createMockConnect(
	readRows?: Record<string, Record<string, unknown>[]>,
) {
	const tables = new Map<string, ReturnType<typeof createTable>>();
	mockCreateTable.mockImplementation(
		async (name: string, rows: Record<string, unknown>[]) => {
			const table = createTable([...rows]);
			tables.set(name, table);
			return table;
		},
	);
	mockOpenTable.mockImplementation(async (name: string) => {
		const table = tables.get(name) ?? createTable(readRows?.[name] ?? []);
		tables.set(name, table);
		return table;
	});
	return vi.fn().mockResolvedValue({
		createTable: mockCreateTable,
		openTable: mockOpenTable,
	});
}

describe("LanceDB Dump Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("writes v2 normalized tables without embedded image data", async () => {
		const { createLanceDbDumpService } = await import(
			"@solid-imager/application/services/lancedb-dump-service"
		);
		const service = createLanceDbDumpService({ connect: createMockConnect() });

		const items: MediaDumpItem[] = [
			{
				id: "item-1",
				filePath: "test/image1.png",
				fileName: "image1.png",
				mediaType: "image",
				width: 100,
				height: 100,
				fileSize: 1024,
				tags: [{ name: "tag-a", type: "positive", confidence: 0.9 }],
				authors: [{ name: "author-a", accountId: "acct" }],
				characters: [{ name: "char-a", linkedIps: ["ip-a"] }],
				ips: [{ name: "ip-a" }],
				projects: [{ name: "project-a" }],
				sourceUrls: ["https://example.com/image1"],
			},
		];

		await service.writeToLanceDB(items, {
			includeImages: true,
			getImageBuffer: vi.fn(),
		});

		expect(mockCreateTable).toHaveBeenCalledTimes(9);
		expect(mockCreateTable.mock.calls.map((call) => call[0])).toEqual([
			"media",
			"media_tags",
			"media_authors",
			"media_characters",
			"media_character_ips",
			"media_ips",
			"media_projects",
			"media_urls",
			"media_generation_info",
		]);

		const mediaRows = mockCreateTable.mock.calls[0][1];
		expect(mediaRows[0]).toMatchObject({
			id: "item-1",
			filePath: "test/image1.png",
			fileName: "image1.png",
		});
		expect(mediaRows[0]).not.toHaveProperty("imageData");
	});

	it("reads v2 tables back into MediaDumpItem chunks", async () => {
		const { createLanceDbDumpService } = await import(
			"@solid-imager/application/services/lancedb-dump-service"
		);
		const service = createLanceDbDumpService({
			connect: createMockConnect({
				media: [
					{
						id: "item-1",
						filePath: "test/image1.png",
						fileName: "image1.png",
						mediaType: "image",
						width: 100,
						height: 100,
					},
				],
				media_tags: [{ mediaId: "item-1", name: "tag-a", type: "positive" }],
				media_authors: [
					{ mediaId: "item-1", name: "author-a", accountId: "acct" },
				],
				media_characters: [{ mediaId: "item-1", name: "char-a" }],
				media_character_ips: [
					{ mediaId: "item-1", characterName: "char-a", ipName: "ip-a" },
				],
				media_ips: [{ mediaId: "item-1", name: "ip-a" }],
				media_projects: [{ mediaId: "item-1", name: "project-a" }],
				media_urls: [{ mediaId: "item-1", url: "https://example.com/image1" }],
				media_generation_info: [
					{
						mediaId: "item-1",
						prompt: "prompt",
						workflowJson: JSON.stringify({ node: true }),
					},
				],
			}),
		});

		const chunks: MediaDumpItem[][] = [];
		const result = await service.readFromLanceDB("/tmp/lancedb", {
			onChunk: async (chunk) => {
				chunks.push(chunk);
			},
		});

		expect(result).toEqual([]);
		expect(chunks).toHaveLength(1);
		expect(chunks[0][0]).toMatchObject({
			id: "item-1",
			filePath: "test/image1.png",
			tags: [{ name: "tag-a", type: "positive" }],
			authors: [{ name: "author-a", accountId: "acct" }],
			characters: [{ name: "char-a", linkedIps: ["ip-a"] }],
			ips: [{ name: "ip-a" }],
			projects: [{ name: "project-a" }],
			sourceUrls: ["https://example.com/image1"],
		});
		expect(chunks[0][0].generationInfo?.workflow).toEqual({ node: true });
	});
});

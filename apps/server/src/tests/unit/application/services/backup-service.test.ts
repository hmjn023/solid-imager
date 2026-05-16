import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { BackupService } from "~/application/services/backup-service";
import { db } from "~/infrastructure/db";
import {
	mediaCharacters,
	mediaIps,
	mediaTags,
} from "~/infrastructure/db/schema";

const { mockValues, mockDelete, mockFindMany, mockTxDelete } =
	vi.hoisted(() => {
		const mkTxDelete = vi.fn(() => ({
			where: vi.fn(),
		}));
		return {
			mockValues: vi.fn(() => ({
				onConflictDoNothing: vi.fn(),
				onConflictDoUpdate: vi.fn(),
			})),
			mockDelete: vi.fn(() => ({
				where: vi.fn(),
			})),
			mockFindMany: vi.fn(),
			mockTxDelete: mkTxDelete,
		};
	});

	vi.mock("~/infrastructure/db", () => ({
	db: {
		query: {
			medias: {
				findMany: mockFindMany,
				findFirst: vi.fn(),
			},
			mediaSources: {
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn(() => ({
			values: mockValues,
		})),
		delete: mockDelete,
		select: vi.fn(),
		transaction: vi.fn(async (cb: any) =>
			cb({
				query: {
					medias: {
						findMany: mockFindMany,
						findFirst: vi.fn(),
					},
					mediaSources: {
						findFirst: vi.fn(),
					},
				},
				insert: vi.fn(() => ({
					values: mockValues,
				})),
				delete: mockTxDelete,
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(),
					})),
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(),
					})),
				})),
			}),
		),
	},
}));

describe("BackupService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("_transformMediaList", () => {
		it("should include source and confidence in the exported dump", () => {
			const mockMediaList = [
				{
					id: "media-1",
					filePath: "path/to/media.jpg",
					fileName: "media.jpg",
					// ... other fields
					tags: [
						{
							tag: { name: "tag1" },
							tagType: "positive",
							confidence: 0.95,
							source: "AI",
						},
						{
							tag: { name: "tag2" },
							tagType: "negative",
							confidence: null,
							source: "manual",
						},
					],
					characters: [
						{
							character: {
								name: "char1",
								description: "desc",
								ips: [{ ip: { name: "ip1" } }],
							},
							confidence: 0.8,
							source: "AI",
						},
					],
					ips: [
						{
							ip: { name: "ip1", description: "desc" },
							confidence: 0.7,
							source: "AI",
						},
					],
					authors: [],
					projects: [],
					urls: [],
					generationInfo: null,
				},
			];

			const result = BackupService._transformMediaList(mockMediaList);

			expect(result).toHaveLength(1);
			const item = result[0];

			// Verify Tags
			expect(item.tags).toHaveLength(2);
			expect(item.tags?.[0]).toMatchObject({
				name: "tag1",
				type: "positive",
				confidence: 0.95,
				source: "AI",
			});
			expect(item.tags?.[1]).toMatchObject({
				name: "tag2",
				type: "negative",
				confidence: null,
				source: "manual",
			});

			// Verify Characters
			expect(item.characters).toHaveLength(1);
			expect(item.characters?.[0]).toMatchObject({
				name: "char1",
				confidence: 0.8,
				source: "AI",
			});
			expect(item.characters?.[0].linkedIps).toContain("ip1");

			// Verify IPs
			expect(item.ips).toHaveLength(1);
			expect(item.ips?.[0]).toMatchObject({
				name: "ip1",
				confidence: 0.7,
				source: "AI",
			});
		});
	});

	describe("_restoreRelations", () => {
		it("should restore source and confidence for relations", async () => {
			const validItems: MediaDumpItem[] = [
				{
					filePath: "media1.jpg",
					tags: [
						{ name: "tag1", type: "positive", confidence: 0.9, source: "AI" },
						{ name: "tag2", type: "positive", source: "manual" }, // no confidence
						{ name: "tag3", type: "positive" }, // no source, no confidence (should default)
					],
					characters: [
						{ name: "char1", confidence: 0.85, source: "AI" },
						{ name: "char2" }, // defaults
					],
					ips: [
						{ name: "ip1", confidence: 0.75, source: "AI" },
						{ name: "ip2" }, // defaults
					],
				},
			];

			const mediaPathToId = new Map([["media1.jpg", "media-uuid"]]);
			const tagMap = new Map([
				["tag1", "tag-1-uuid"],
				["tag2", "tag-2-uuid"],
				["tag3", "tag-3-uuid"],
			]);
			const charMap = new Map([
				["char1", "char-1-uuid"],
				["char2", "char-2-uuid"],
			]);
			const ipMap = new Map([
				["ip1", "ip-1-uuid"],
				["ip2", "ip-2-uuid"],
			]);

			await BackupService._restoreRelations({
				validItems,
				mediaPathToId,
				tagMap,
				authorMap: new Map(),
				projectMap: new Map(),
				ipMap,
				charMap,
			});

		// Helper to extract values for a specific table in a robust way
		const getValuesForTable = (tableSchema: any) => {
			const values: any[] = [];
			(db.insert as any).mock.calls.forEach(
				(insertArgs: any[], index: number) => {
					if (insertArgs[0] === tableSchema) {
						const valuesCall = mockValues.mock.calls[index] as any[];
						if (valuesCall?.[0]) {
							values.push(...(valuesCall[0] as any[]));
						}
					}
				},
			);
			return values;
		};

			const tagsData = getValuesForTable(mediaTags);
			const charsData = getValuesForTable(mediaCharacters);
			const ipsData = getValuesForTable(mediaIps);

			const expectedTagsCount = 3;
			const expectedCharsCount = 2;
			const expectedIpsCount = 2;

			// Assert Tags
			expect(tagsData).toHaveLength(expectedTagsCount);
			expect(tagsData).toContainEqual(
				expect.objectContaining({
					tagId: "tag-1-uuid",
					confidence: 0.9,
					source: "AI",
				}),
			);
			expect(tagsData).toContainEqual(
				expect.objectContaining({
					tagId: "tag-2-uuid",
					confidence: null,
					source: "manual",
				}),
			);
			expect(tagsData).toContainEqual(
				expect.objectContaining({
					tagId: "tag-3-uuid",
					confidence: null,
					source: "restored", // Default
				}),
			);

			// Assert Characters
			expect(charsData).toHaveLength(expectedCharsCount);
			expect(charsData).toContainEqual(
				expect.objectContaining({
					characterId: "char-1-uuid",
					confidence: 0.85,
					source: "AI",
				}),
			);
			expect(charsData).toContainEqual(
				expect.objectContaining({
					characterId: "char-2-uuid",
					confidence: null,
					source: "restored", // Default
				}),
			);

			// Assert IPs
			expect(ipsData).toHaveLength(expectedIpsCount);
			expect(ipsData).toContainEqual(
				expect.objectContaining({
					ipId: "ip-1-uuid",
					confidence: 0.75,
					source: "AI",
				}),
			);
			expect(ipsData).toContainEqual(
				expect.objectContaining({
					ipId: "ip-2-uuid",
					confidence: null,
					source: "restored", // Default
				}),
			);
		});
	});
});

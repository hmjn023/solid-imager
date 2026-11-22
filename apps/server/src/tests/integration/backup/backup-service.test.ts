import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db";
import {
	authorAccounts,
	authors,
	characterIps,
	characters,
	ips,
	jobs,
	mediaAuthors,
	mediaCharacters,
	mediaIps,
	mediaProjects,
	mediaSources,
	medias,
	mediaTags,
	mediaUrls,
	projects,
	tagDictionaryTags,
	tags,
} from "~/infrastructure/db/schema";
import {
	MediaRepository,
	TagDictionaryRepository,
} from "~/infrastructure/db/repositories";
import { BackupService } from "~/infrastructure/services/backup-service";

// Mock external modules if necessary (e.g. storage driver, archiver)
vi.mock("~/infrastructure/storage/factory", () => ({
	getDriver: vi.fn().mockReturnValue({
		get: vi.fn().mockResolvedValue(Buffer.from("mock-content")),
		put: vi.fn().mockResolvedValue(undefined),
	}),
}));

describe("BackupService Integration", () => {
	const testSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
	const confidenceTag = 0.85;
	const confidenceChar = 0.92;
	const confidenceRestoreTag = 0.77;
	const confidenceRestoreChar = 0.88;

	beforeEach(async () => {
		// Clean DB
		await db.delete(jobs);
		await db.delete(mediaProjects);
		await db.delete(mediaCharacters);
		await db.delete(mediaIps);
		await db.delete(mediaAuthors);
		await db.delete(medias);
		await db.delete(projects);
		await db.delete(characters);
		await db.delete(ips);
		await db.delete(authors);
		await db.delete(tags);
		await db.delete(mediaSources);

		// Create Source
		await db.insert(mediaSources).values({
			id: testSourceId,
			name: "Test Source",
			type: "local",
			connectionInfo: { path: "/test" },
		});
	});

	it("does not enqueue per-media processing jobs during local restore", async () => {
		const accessSpy = vi.spyOn(fs, "access").mockResolvedValue(undefined);

		try {
			const result = await BackupService.restoreSource(testSourceId, [
				{
					filePath: "local-restore.png",
					fileName: "local-restore.png",
					mediaType: "image",
					width: 100,
					height: 100,
					fileSize: 1024,
				},
			]);

			expect(result.processed).toBe(1);
			expect(accessSpy).toHaveBeenCalledTimes(1);
		} finally {
			accessSpy.mockRestore();
		}

		const processMediaJobs = await db
			.select({ id: jobs.id })
			.from(jobs)
			.where(
				and(
					eq(jobs.mediaSourceId, testSourceId),
					eq(jobs.type, "processMedia"),
				),
			);
		expect(processMediaJobs).toHaveLength(0);
	});

	it("restores pre-migration tag names onto the current tag without recreating them", async () => {
		const access = vi.spyOn(fs, "access").mockResolvedValue(undefined);
		const currentName = "backup_canonical";
		const oldName = "backup_legacy";
		await db.insert(tagDictionaryTags).values({
			name: currentName,
			category: 0,
			postCount: 1,
			aliases: [],
			searchText: currentName,
		});
		try {
			const item = {
				filePath: "tag-migration.png",
				fileName: "tag-migration.png",
				mediaType: "image",
				width: 10,
				height: 10,
				tags: [
					{
						name: oldName,
						type: "positive",
						source: "manual",
						confidence: 0.8,
					},
					{ name: oldName, type: "negative", source: "AI", confidence: 0.6 },
					{ name: oldName, type: "positive", source: "AI", confidence: 0.4 },
				],
			};
			expect(
				(await BackupService.restoreSource(testSourceId, [item])).processed,
			).toBe(1);
			const [old] = await db.select().from(tags).where(eq(tags.name, oldName));
			expect(
				await TagDictionaryRepository.migrateLegacy({
					tagId: old.id,
					sourceName: old.name,
					target: currentName,
				}),
			).toBe(true);
			const restored = await BackupService.restoreSource(testSourceId, [
				{
					...item,
					tags: [
						...item.tags,
						{ name: currentName, type: "positive", source: "AI" },
					],
				},
			]);
			expect(restored.processed).toBe(1);
			expect(
				await db.select().from(tags).where(eq(tags.name, oldName)),
			).toEqual([]);
			const [media] = await db
				.select()
				.from(medias)
				.where(eq(medias.filePath, item.filePath));
			const restoredTags = await db
				.select()
				.from(mediaTags)
				.where(eq(mediaTags.mediaId, media.id));
			expect(restoredTags).toHaveLength(2);
			expect(restoredTags).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tagId: old.id,
						tagType: "positive",
						source: "manual",
						confidence: expect.closeTo(0.8),
					}),
					expect.objectContaining({
						tagId: old.id,
						tagType: "negative",
						source: "AI",
						confidence: expect.closeTo(0.6),
					}),
				]),
			);
		} finally {
			access.mockRestore();
			await db
				.delete(tagDictionaryTags)
				.where(eq(tagDictionaryTags.name, currentName));
		}
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should include projects, characters, ips, authors, and sourceUrls in JSON dump", async () => {
		// 1. Setup Data
		const [media] = await db
			.insert(medias)
			.values({
				mediaSourceId: testSourceId,
				filePath: "test.png",
				fileName: "test.png",
				mediaType: "image",
				width: 100,
				height: 100,
				fileSize: 1024,
			})
			.returning();

		const [tag] = await db
			.insert(tags)
			.values({ name: "Dump Tag" })
			.returning();
		await db.insert(mediaTags).values({
			mediaId: media.id,
			tagId: tag.id,
			tagType: "positive",
			confidence: confidenceTag,
		});

		const [project] = await db
			.insert(projects)
			.values({ name: "Dump Project" })
			.returning();
		const [ip] = await db.insert(ips).values({ name: "Dump IP" }).returning();
		const [character] = await db
			.insert(characters)
			.values({ name: "Dump Character" })
			.returning();
		await db
			.insert(characterIps)
			.values({ characterId: character.id, ipId: ip.id, source: "manual" });
		const [author] = await db
			.insert(authors)
			.values({ name: "Dump Author" })
			.returning();
		await db.insert(authorAccounts).values([
			{
				authorId: author.id,
				platform: "twitter",
				accountId: "dump-author-twitter",
				createdAt: new Date("2026-02-02"),
			},
			{
				authorId: author.id,
				platform: "pixiv-fanbox",
				accountId: "dump-author",
				createdAt: new Date("2026-02-01"),
			},
		]);

		await db
			.insert(mediaProjects)
			.values({ mediaId: media.id, projectId: project.id });
		await db.insert(mediaIps).values({ mediaId: media.id, ipId: ip.id });
		await db.insert(mediaCharacters).values({
			mediaId: media.id,
			characterId: character.id,
			confidence: confidenceChar,
		});
		await db
			.insert(mediaAuthors)
			.values({ mediaId: media.id, authorId: author.id });
		await db
			.insert(mediaUrls)
			.values({ mediaId: media.id, url: "https://example.com/source" });

		// 2. Execute Dump
		const dumpStream = (await BackupService.createDump(
			testSourceId,
			"ndjson",
		)) as ReadableStream;

		// 3. Verify
		const reader = dumpStream.getReader();
		const decoder = new TextDecoder();
		let chunkResult = "";
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunkResult += decoder.decode(value, { stream: true });
		}
		chunkResult += decoder.decode();

		const lines = chunkResult.split("\n").filter(Boolean);
		expect(lines.length).toBe(1);
		const item = JSON.parse(lines[0]);

		expect(item.filePath).toBe("test.png");

		expect(item.tags).toHaveLength(1);
		expect(item.tags[0].name).toBe("Dump Tag");
		expect(item.tags[0].confidence).toBe(confidenceTag);

		expect(item.projects).toHaveLength(1);
		expect(item.projects[0].name).toBe("Dump Project");

		expect(item.characters).toHaveLength(1);
		expect(item.characters[0].name).toBe("Dump Character");
		expect(item.characters[0].confidence).toBe(confidenceChar);
		expect(item.characters[0].linkedIps).toEqual(["Dump IP"]);

		expect(item.ips).toHaveLength(1);
		expect(item.ips[0].name).toBe("Dump IP");

		expect(item.authors).toHaveLength(1);
		expect(item.authors[0].name).toBe("Dump Author");
		expect(item.authors[0].platform).toBe("pixiv-fanbox");
		expect(item.authors[0].accounts).toMatchObject([
			{ accountId: "dump-author" },
			{ accountId: "dump-author-twitter" },
		]);
		const linkedAuthors = await MediaRepository.getAuthors(media.id);
		expect(linkedAuthors).toMatchObject([
			{
				id: author.id,
				accountId: "dump-author",
				accounts: [
					{ accountId: "dump-author" },
					{ accountId: "dump-author-twitter" },
				],
			},
		]);
		expect((await MediaRepository.getDetails(media.id))?.authors).toEqual(
			linkedAuthors,
		);

		expect(item.sourceUrls).toHaveLength(1);
		expect(item.sourceUrls[0]).toBe("https://example.com/source");
	});

	it("exports every external identity belonging to an author", () => {
		const [item] = BackupService._transformMediaList([
			{
				authors: [
					{
						name: "Multi-account Author",
						accounts: [
							{
								platform: "twitter",
								accountId: "account-b",
							},
							{
								platform: "pixiv-fanbox",
								accountId: "account-a",
							},
						],
					},
				],
			},
		]);

		expect(item?.authors).toEqual([
			expect.objectContaining({
				name: "Multi-account Author",
				accounts: expect.arrayContaining([
					expect.objectContaining({
						platform: "pixiv-fanbox",
						accountId: "account-a",
					}),
					expect.objectContaining({
						platform: "twitter",
						accountId: "account-b",
					}),
				]),
			}),
		]);
	});

	it("restores multiple account profiles and a separate management name through a JSON dump", async () => {
		await db
			.update(mediaSources)
			.set({ type: "s3" })
			.where(eq(mediaSources.id, testSourceId));
		const [item] = BackupService._transformMediaList([
			{
				filePath: "profiles.png",
				fileName: "profiles.png",
				mediaType: "image",
				width: 100,
				height: 100,
				fileSize: 100,
				authors: [
					{
						name: "My management label",
						accounts: [
							{
								platform: "twitter",
								accountId: "renamed",
								remoteId: "18446744073709551615",
								displayName: "External display",
								profileUrl: "https://x.com/renamed",
								observedAt: new Date("2026-02-01"),
							},
							{
								platform: "pixiv-fanbox",
								accountId: "fanbox-creator",
								remoteId: "789",
								displayName: "Other profile",
								profileUrl: "https://fanbox-creator.fanbox.cc",
								observedAt: new Date("2026-01-01"),
							},
						],
					},
				],
			},
		]);
		const result = await BackupService.restoreSource(testSourceId, [
			JSON.parse(JSON.stringify(item)),
		]);
		expect(result.errors).toEqual([]);
		expect(result.processed).toBe(1);
		const restored = await db.query.authors.findFirst({
			with: { accounts: true },
		});
		expect(restored?.name).toBe("My management label");
		expect(restored?.accounts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					platform: "twitter",
					accountId: "renamed",
					remoteId: "18446744073709551615",
					displayName: "External display",
					observedAt: new Date("2026-02-01"),
				}),
				expect.objectContaining({
					platform: "pixiv-fanbox",
					accountId: "fanbox-creator",
					remoteId: "789",
					displayName: "Other profile",
				}),
			]),
		);
		expect(restored?.accounts).toHaveLength(2);
	});

	it("should restore projects, characters, ips, authors, and sourceUrls from dump item", async () => {
		// Update source type to s3 to bypass fs.access check
		await db
			.update(mediaSources)
			.set({ type: "s3" })
			.where(eq(mediaSources.id, testSourceId));

		// 1. Prepare dump item
		const dumpItem = {
			filePath: "restore.png",
			fileName: "restore.png",
			mediaType: "image",
			width: 200,
			height: 200,
			fileSize: 2048,
			createdAt: new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
			tags: [{ name: "Restore Tag", confidence: confidenceRestoreTag }],
			projects: [{ name: "Restore Project" }],
			characters: [
				{ name: "Restore Character", confidence: confidenceRestoreChar },
			],
			ips: [{ name: "Restore IP" }],
			authors: [
				{
					name: "Restore Author",
					accountId: "test_account_123",
					platform: "pixiv-fanbox",
				},
			],
			sourceUrls: ["https://example.com/restore"],
		};

		// 2. Execute Restore (simulate processing single item)
		// Actually calling restoreSource with list of 1
		const result = await BackupService.restoreSource(testSourceId, [dumpItem]);

		expect(result.processed).toBe(1);
		expect(result.skipped).toBe(0);
		expect(result.errors).toHaveLength(0);

		// 3. Verify DB
		const restoredMedia = await db.query.medias.findFirst({
			where: { filePath: "restore.png" },
			with: {
				tags: true,
				projects: { with: { project: true } },
				characters: true,
				ips: { with: { ip: true } },
				authors: { with: { accounts: true } },
				urls: true,
			},
		});

		expect(restoredMedia).toBeDefined();
		expect(restoredMedia?.tags).toHaveLength(1);
		expect(restoredMedia?.tags[0].confidence).toBe(confidenceRestoreTag);

		expect(restoredMedia?.projects).toHaveLength(1);
		expect(restoredMedia?.projects[0].project.name).toBe("Restore Project");

		expect(restoredMedia?.characters).toHaveLength(1);
		expect(restoredMedia?.characters[0].confidence).toBe(confidenceRestoreChar);

		expect(restoredMedia?.ips).toHaveLength(1);
		expect(restoredMedia?.ips[0].ip.name).toBe("Restore IP");

		expect(restoredMedia?.authors).toHaveLength(1);
		expect(restoredMedia?.authors[0].name).toBe("Restore Author");
		expect(restoredMedia?.authors[0].accounts[0]?.accountId).toBe(
			"test_account_123",
		);
		expect(restoredMedia?.authors[0].accounts).toEqual([
			expect.objectContaining({
				platform: "pixiv-fanbox",
				accountId: "test_account_123",
			}),
		]);

		expect(restoredMedia?.urls).toHaveLength(1);
		expect(restoredMedia?.urls[0].url).toBe("https://example.com/restore");
	});

	it("restores same-name authors separately by platform account identity", async () => {
		await db
			.update(mediaSources)
			.set({ type: "s3" })
			.where(eq(mediaSources.id, testSourceId));

		const baseItem = {
			mediaType: "image",
			width: 100,
			height: 100,
			fileSize: 1024,
			createdAt: new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
		};
		const result = await BackupService.restoreSource(testSourceId, [
			{
				...baseItem,
				filePath: "fanbox.png",
				fileName: "fanbox.png",
				authors: [
					{
						name: "Shared Name",
						accountId: "fanbox-creator",
						platform: "pixiv-fanbox",
					},
				],
			},
			{
				...baseItem,
				filePath: "twitter.png",
				fileName: "twitter.png",
				authors: [
					{
						name: "Shared Name",
						accountId: "twitter-creator",
						platform: "twitter",
					},
				],
			},
		]);

		expect(result.processed).toBe(2);
		const restored = await db.query.medias.findMany({
			where: { mediaSourceId: testSourceId },
			with: { authors: { with: { accounts: true } } },
		});
		const authorIds = restored.map((media) => media.authors[0]?.id);
		expect(new Set(authorIds).size).toBe(2);
		expect(
			restored.map((media) => media.authors[0]?.accounts[0]?.platform),
		).toEqual(expect.arrayContaining(["pixiv-fanbox", "twitter"]));
	});

	it("should infer character-IP relationships from media when linkedIps is not provided", async () => {
		// Update source type to s3 to bypass fs.access check
		await db
			.update(mediaSources)
			.set({ type: "s3" })
			.where(eq(mediaSources.id, testSourceId));

		// 1. Prepare dump item with character but no linkedIps
		const dumpItem = {
			filePath: "infer-test.png",
			fileName: "infer-test.png",
			mediaType: "image",
			width: 300,
			height: 300,
			fileSize: 3072,
			createdAt: new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
			characters: [{ name: "Inferred Character" }],
			ips: [{ name: "Inferred IP 1" }, { name: "Inferred IP 2" }],
		};

		// 2. Execute Restore
		const result = await BackupService.restoreSource(testSourceId, [dumpItem]);

		expect(result.processed).toBe(1);
		expect(result.errors).toHaveLength(0);

		// 3. Verify character-IP relationships were inferred from media
		const character = await db.query.characters.findFirst({
			where: { name: "Inferred Character" },
			with: { ips: true },
		});

		expect(character).toBeDefined();
		expect(character?.ips).toHaveLength(2);
		const ipNames = character?.ips.map((ip) => ip.name).sort();
		expect(ipNames).toEqual(["Inferred IP 1", "Inferred IP 2"]);
	});

	it("should prioritize linkedIps over media IPs when both are present", async () => {
		// Update source type to s3 to bypass fs.access check
		await db
			.update(mediaSources)
			.set({ type: "s3" })
			.where(eq(mediaSources.id, testSourceId));

		// 1. Prepare dump item with both linkedIps and media IPs
		const dumpItem = {
			filePath: "priority-test.png",
			fileName: "priority-test.png",
			mediaType: "image",
			width: 400,
			height: 400,
			fileSize: 4096,
			createdAt: new Date().toISOString(),
			modifiedAt: new Date().toISOString(),
			characters: [
				{
					name: "Priority Character",
					linkedIps: ["Specific IP"], // Should use this
				},
			],
			ips: [{ name: "Specific IP" }, { name: "Other IP" }], // Should ignore "Other IP"
		};

		// 2. Execute Restore
		const result = await BackupService.restoreSource(testSourceId, [dumpItem]);

		expect(result.processed).toBe(1);
		expect(result.errors).toHaveLength(0);

		// 3. Verify only linkedIps were used
		const character = await db.query.characters.findFirst({
			where: { name: "Priority Character" },
			with: { ips: true },
		});

		expect(character).toBeDefined();
		expect(character?.ips).toHaveLength(1);
		expect(character?.ips[0].name).toBe("Specific IP");
	});
});

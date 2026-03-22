import { eq } from "drizzle-orm";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { BackupService } from "~/application/services/backup-service";
import { db } from "~/infrastructure/db";
import {
	authors,
	characterIps,
	characters,
	ips,
	mediaAuthors,
	mediaCharacters,
	mediaIps,
	mediaProjects,
	mediaSources,
	medias,
	mediaTags,
	mediaUrls,
	projects,
	tags,
} from "~/infrastructure/db/schema";

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
		const dumpResult = await BackupService.createDump(testSourceId, "json");

		// 3. Verify
		expect(Array.isArray(dumpResult)).toBe(true);
		const item = (dumpResult as any[])[0];

		expect(item.filePath).toBe("test.png");

		expect(item.tags).toHaveLength(1);
		expect(item.tags[0].name).toBe("Dump Tag");
		expect(item.tags[0].confidence).toBe(confidenceTag);

		expect(item.projects).toHaveLength(1);
		expect(item.projects[0].name).toBe("Dump Project");

		expect(item.characters).toHaveLength(1);
		expect(item.characters[0].name).toBe("Dump Character");
		expect(item.characters[0].confidence).toBe(confidenceChar);

		expect(item.ips).toHaveLength(1);
		expect(item.ips[0].name).toBe("Dump IP");

		expect(item.authors).toHaveLength(1);
		expect(item.authors[0].name).toBe("Dump Author");

		expect(item.sourceUrls).toHaveLength(1);
		expect(item.sourceUrls[0]).toBe("https://example.com/source");
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
			authors: [{ name: "Restore Author", accountId: "test_account_123" }],
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
			where: eq(medias.filePath, "restore.png"),
			with: {
				tags: true,
				projects: { with: { project: true } },
				characters: true,
				ips: { with: { ip: true } },
				authors: { with: { author: true } },
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
		expect(restoredMedia?.authors[0].author.name).toBe("Restore Author");
		expect(restoredMedia?.authors[0].author.accountId).toBe("test_account_123");

		expect(restoredMedia?.urls).toHaveLength(1);
		expect(restoredMedia?.urls[0].url).toBe("https://example.com/restore");
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
			where: eq(characters.name, "Inferred Character"),
			with: { ips: { with: { ip: true } } },
		});

		expect(character).toBeDefined();
		expect(character?.ips).toHaveLength(2);
		const ipNames = character?.ips.map((ci) => ci.ip.name).sort();
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
			where: eq(characters.name, "Priority Character"),
			with: { ips: { with: { ip: true } } },
		});

		expect(character).toBeDefined();
		expect(character?.ips).toHaveLength(1);
		expect(character?.ips[0].ip.name).toBe("Specific IP");
	});
});

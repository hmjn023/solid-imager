import { eq } from "drizzle-orm";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vite-plus/test";
import { ZodError } from "zod";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { db } from "~/infrastructure/db/index";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const TEST_FILE_SIZE = 1024 * 1024;
const TEST_UPDATED_SIZE = 2048 * 1024;
const TEST_WIDTH = 800;
const TEST_UPDATED_WIDTH = 1200;

const MEDIA_NOT_FOUND_PATTERN = /Media.*not found/;

describe("updateMedia Integration", () => {
	beforeAll(() => {
		// Register services
		services.registerMediaRepository(MediaRepository);
		services.registerSourceRepository(DrizzleSourceRepository);
		services.registerMediaStorage(ServerMediaStorage);
		services.registerTagRepository(TagRepository);
		services.registerImageProcessor(ImageProcessor);
		services.registerAuthorRepository(AuthorRepository);
		services.registerProjectRepository(ProjectRepository);
		services.registerCharacterRepository(DrizzleCharacterRepository);
		services.registerIpRepository(IpRepository);
		services.registerAiClient(new RustAiClient());
	});
	let testMediaId: string;
	const testSourceId = crypto.randomUUID();
	const initialMediaData = {
		mediaSourceId: testSourceId,
		filePath: `/ test / path / initial_image - ${Date.now()}.png`,
		fileName: "initial_image.png",
		fileSize: TEST_FILE_SIZE,
		mediaType: "image" as const,
		width: TEST_WIDTH,
		height: 600,
		description: null,
		sourceUrl: null,
	};

	beforeEach(async () => {
		// 以前のテストデータをクリーンアップします。
		await db.delete(medias);

		// テスト用のmedia sourceを作成
		await db
			.insert(mediaSources)
			.values({
				id: testSourceId,
				name: "Test Source",
				type: "local",
				connectionInfo: { path: "/test" },
			})
			.onConflictDoNothing();
		// データベースに初期メディアエントリを追加します。
		const addedMedia = await MediaRepository.create(initialMediaData);
		testMediaId = addedMedia.id;
	});

	afterEach(async () => {
		// 各テスト後に、追加されたメディアをクリーンアップします。
		if (testMediaId) {
			await db.delete(medias).where(eq(medias.id, testMediaId));
		}
	});

	it("should successfully update media in the database", async () => {
		const updates = {
			fileName: "updated_image.png",
			description: "This is an updated description",
			width: TEST_UPDATED_WIDTH,
			fileSize: TEST_UPDATED_SIZE,
		};

		const updatedMedia = await MediaService.updateMedia(
			testSourceId,
			testMediaId,
			updates,
		);

		expect(updatedMedia).toBeDefined();
		expect(updatedMedia.id).toBe(testMediaId);
		expect(updatedMedia.fileName).toBe(updates.fileName);
		expect(updatedMedia.fileSize).toBe(updates.fileSize);
		expect(updatedMedia.description).toBe(updates.description);
		expect(updatedMedia.width).toBe(updates.width);
		expect(updatedMedia.modifiedAt).toBeInstanceOf(Date);

		// 変更がデータベースに永続化されていることを確認します。
		const mediaInDb = await MediaService.getMedia(testSourceId, testMediaId);
		expect(mediaInDb.fileName).toBe(updates.fileName);
		expect(mediaInDb.description).toBe(updates.description);
		expect(mediaInDb.width).toBe(updates.width);
	});

	it("should throw an error if mediaId is not found for the given mediaSourceId", async () => {
		const nonExistentId = "a0000000-0000-4000-8000-000000000000";
		const updates = { fileName: "non_existent.png" };
		await expect(
			MediaService.updateMedia(testSourceId, nonExistentId, updates),
		).rejects.toThrow(MEDIA_NOT_FOUND_PATTERN);
	});

	it("should throw a ZodError for an invalid mediaId format", async () => {
		const invalidId = "invalid-uuid";
		const updates = { fileName: "test.png" };
		await expect(
			MediaService.updateMedia(testSourceId, invalidId, updates),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError for an invalid mediaSourceId format", async () => {
		const invalidSourceId = "invalid-uuid";
		const updates = { fileName: "test.png" };
		await expect(
			MediaService.updateMedia(invalidSourceId, testMediaId, updates),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError for invalid update data", async () => {
		const invalidUpdates = { width: -100 }; // 無効なフィールド
		await expect(
			MediaService.updateMedia(
				testSourceId,
				testMediaId,
				invalidUpdates as any,
			),
		).rejects.toBeInstanceOf(ZodError);
	});
});

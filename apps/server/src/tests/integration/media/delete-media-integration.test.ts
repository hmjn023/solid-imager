import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { PythonClient } from "~/infrastructure/ai/python-client";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
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

const MEDIA_NOT_FOUND_PATTERN = /Media.*not found/;

describe("deleteMedia Integration", () => {
	let testMediaId: string;
	const mediaSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";

	beforeAll(async () => {
		services.registerMediaRepository(MediaRepository);
		services.registerSourceRepository(DrizzleSourceRepository);
		services.registerMediaStorage(ServerMediaStorage);
		services.registerTagRepository(TagRepository);
		services.registerImageProcessor(ImageProcessor);
		services.registerAuthorRepository(AuthorRepository);
		services.registerProjectRepository(ProjectRepository);
		services.registerCharacterRepository(DrizzleCharacterRepository);
		services.registerIpRepository(IpRepository);
		services.registerAiClient(new PythonClient());

		await db.delete(medias);

		// テスト用のmedia sourceを作成
		await db
			.insert(mediaSources)
			.values({
				id: mediaSourceId,
				name: "Test Source",
				type: "local",
				connectionInfo: { path: "/test" },
			})
			.onConflictDoNothing();
		const initialMediaData: NewMedia = {
			mediaSourceId,
			filePath: `/test/path/to_delete-${Date.now()}.png`,
			fileName: "to_delete.png",
			fileSize: 1024,
			mediaType: "image",
			width: 800,
			height: 600,
			description: "",
		};
		// データベースに初期メディアエントリを追加します。
		const addedMedia = await MediaRepository.create(initialMediaData as any);
		testMediaId = addedMedia.id;
	});

	afterAll(async () => {
		// クリーンアップ
		await db.delete(medias);
	});

	it("should successfully delete media from the database", async () => {
		await MediaService.deleteMedia(mediaSourceId, testMediaId);
		// expect(result.success).toBe(true); // deleteMedia returns void now

		// メディアがデータベースから削除されたことを確認します。
		const mediaInDb = await db
			.select()
			.from(medias)
			.where(eq(medias.id, testMediaId));
		expect(mediaInDb.length).toBe(0);
	});

	it("should throw an error if mediaId is not found for the given mediaSourceId", async () => {
		const nonExistentMediaId = "a0000000-0000-4000-8000-000000000000";
		await expect(
			MediaService.deleteMedia(mediaSourceId, nonExistentMediaId),
		).rejects.toThrow(MEDIA_NOT_FOUND_PATTERN);
	});

	it("should throw a ZodError for an invalid mediaId format", async () => {
		const invalidMediaId = "invalid-uuid";
		await expect(
			MediaService.deleteMedia(mediaSourceId, invalidMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError for an invalid mediaSourceId format", async () => {
		const invalidSourceId = "invalid-uuid";
		await expect(
			MediaService.deleteMedia(invalidSourceId, testMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});
});

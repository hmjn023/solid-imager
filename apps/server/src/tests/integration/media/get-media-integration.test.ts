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

const TEST_FILE_SIZE = 1024 * 1024;
const TEST_WIDTH = 800;

describe("getMedia Integration", () => {
	let testMediaId: string;
	const mediaSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
	const newMediaData: NewMedia = {
		mediaSourceId,
		filePath: `/test/path/image-${Date.now()}.png`,
		fileName: "test_image.png",
		fileSize: TEST_FILE_SIZE,
		mediaType: "image",
		width: TEST_WIDTH,
		height: 600,
		description: "",
	};

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
		// getMediaをテストするために、データベースにメディアエントリを追加します。
		const addedMedia = await MediaRepository.create(newMediaData as any);
		testMediaId = addedMedia.id;
	});

	afterAll(async () => {
		await db.delete(medias);
	});

	it("should successfully retrieve media from the database", async () => {
		const result = await MediaService.getMedia(mediaSourceId, testMediaId);
		expect(result).toBeDefined();
		expect(result.id).toBe(testMediaId);
		expect(result.fileSize).toBe(newMediaData.fileSize);
	});

	it("should throw an error if mediaId is not found for the given mediaSourceId", async () => {
		const nonExistentMediaId = "a0000000-0000-4000-8000-000000000000";
		await expect(
			MediaService.getMedia(mediaSourceId, nonExistentMediaId),
		).rejects.toThrow(MEDIA_NOT_FOUND_PATTERN);
	});

	it("should throw a ZodError for an invalid mediaId format", async () => {
		const invalidMediaId = "invalid-uuid";
		await expect(
			MediaService.getMedia(mediaSourceId, invalidMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError for an invalid mediaSourceId format", async () => {
		const invalidSourceId = "invalid-uuid";
		await expect(
			MediaService.getMedia(invalidSourceId, testMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});
});

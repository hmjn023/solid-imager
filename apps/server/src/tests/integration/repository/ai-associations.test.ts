import { expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import {
	MediaRepository,
	TagRepository,
	IpRepository,
	DrizzleCharacterRepository,
} from "~/infrastructure/db/repositories";

it("rolls back failed AI replacements and preserves manual associations after a successful one", async () => {
	const [source] = await db
		.insert(mediaSources)
		.values({ name: "Test", type: "local", connectionInfo: {} })
		.returning();
	const [media] = await db
		.insert(medias)
		.values({
			mediaSourceId: source.id,
			fileName: "clip.mp4",
			width: 16,
			height: 16,
			filePath: "clip.mp4",
			mediaType: "video",
		})
		.returning();
	for (const origin of ["AI", "manual"]) {
		await TagRepository.addTagsToMedia(
			media.id,
			[{ name: origin, type: "positive" }],
			origin,
		);
		const [ip] = await IpRepository.findOrCreateBulk([origin], origin);
		await IpRepository.addMedia(media.id, ip.id, undefined, origin);
		const [character] = await DrizzleCharacterRepository.findOrCreateBulk(
			[{ name: origin }],
			origin,
		);
		await DrizzleCharacterRepository.addToMedia(
			media.id,
			character.id,
			undefined,
			origin,
		);
	}
	const names = async () =>
		(
			await Promise.all([
				TagRepository.findByMediaId(media.id),
				IpRepository.getMediaIps(media.id),
				DrizzleCharacterRepository.getMediaCharacters(media.id),
			])
		).map((rows) => rows.map((row) => row.name).sort());
	await expect(
		DrizzleTransactionManager.transaction(async (tx) => {
			await MediaRepository.clearAiAssociations(media.id, tx);
			throw new Error("failed to save replacement");
		}),
	).rejects.toThrow("failed to save replacement");
	expect(await names()).toEqual(Array(3).fill(["AI", "manual"]));
	await DrizzleTransactionManager.transaction(async (tx) => {
		await MediaRepository.clearAiAssociations(media.id, tx);
		await TagRepository.addTagsToMedia(
			media.id,
			[{ name: "new", type: "positive" }],
			"AI",
			tx,
		);
	});
	expect(await names()).toEqual([["manual", "new"], ["manual"], ["manual"]]);
});

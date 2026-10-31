import { randomUUID } from "node:crypto";
import path from "node:path";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";
import * as schema from "~/infrastructure/db/schema";
import {
	countCcipTargets,
	countTaggingTargets,
} from "~/infrastructure/services/ai-batch-targets";

describe("AI batch target counts", () => {
	const client = createPglite();
	const database = drizzle(client, { schema });
	const modifiedAt = new Date("2026-01-01T00:00:00.123Z");
	beforeAll(async () => {
		await migrate(database, {
			migrationsFolder: path.resolve(
				process.cwd().endsWith("apps/server")
					? "drizzle"
					: "apps/server/drizzle",
			),
		});
	});
	afterEach(async () => {
		await database.delete(schema.mediaSources);
	});
	afterAll(async () => client.close());

	async function source(type: "local" | "s3" = "local") {
		const id = randomUUID();
		await database.insert(schema.mediaSources).values({
			id,
			name: id,
			type,
			connectionInfo: { path: "/tmp" },
		});
		return id;
	}
	async function media(
		mediaSourceId: string,
		mediaType: "image" | "video" = "image",
	) {
		const id = randomUUID();
		await database.insert(schema.medias).values({
			id,
			mediaSourceId,
			mediaType,
			fileName: id,
			filePath: id,
			width: 256,
			height: 256,
			modifiedAt,
		});
		return id;
	}

	it("counts untagged images, preserving AI/manual and any-category semantics", async () => {
		const local = await source();
		const remote = await source("s3");
		await media(local); // untagged
		const manual = await media(local);
		const tagged = await media(local);
		const character = await media(local);
		const ip = await media(local);
		await media(local, "video");
		await media(remote);
		const tagIds = [randomUUID(), randomUUID()];
		await database
			.insert(schema.tags)
			.values(tagIds.map((id) => ({ id, name: id })));
		await database
			.insert(schema.mediaTags)
			.values([
				{ mediaId: manual, tagId: tagIds[0], source: "manual" },
				...tagIds.map((tagId) => ({ mediaId: tagged, tagId, source: "AI" })),
			]);
		const characterId = randomUUID();
		await database
			.insert(schema.characters)
			.values({ id: characterId, name: characterId });
		await database
			.insert(schema.mediaCharacters)
			.values({ mediaId: character, characterId, source: "AI" });
		const ipId = randomUUID();
		await database.insert(schema.ips).values({ id: ipId, name: ipId });
		await database
			.insert(schema.mediaIps)
			.values({ mediaId: ip, ipId, source: "AI" });
		expect(await countTaggingTargets(database, {})).toBe(3);
		expect(await countTaggingTargets(database, { mediaSourceId: local })).toBe(
			2,
		);
		expect(
			await countTaggingTargets(database, {
				mediaSourceId: local,
				force: true,
			}),
		).toBe(5);
		expect(await countTaggingTargets(database, { force: true })).toBe(6);
		expect(
			await countTaggingTargets(database, { mediaSourceId: randomUUID() }),
		).toBe(0);
	});

	it("counts missing/stale full-image CCIP vectors without loading vector data", async () => {
		const local = await source();
		const other = await source();
		await media(local); // missing
		await media(other);
		await media(local, "video");
		await media(await source("s3"));
		for (const state of [
			"current",
			"stale",
			"model",
			"version",
			"crop",
			"precision",
		]) {
			const mediaId = await media(local);
			const regionId = randomUUID();
			await database.insert(schema.mediaRegions).values({
				id: regionId,
				mediaId,
				kind: state === "crop" ? "person" : "full",
				sourceModifiedAt: modifiedAt,
				...(state === "crop" ? { x: 0, y: 0, width: 0.5, height: 0.5 } : {}),
			});
			await database.insert(schema.ccipEmbeddings).values({
				regionId,
				embedding: Array.from({ length: 768 }, () => 0),
				model: state === "model" ? "old-model" : CCIP_MODEL,
				embeddingVersion:
					state === "version"
						? CCIP_EMBEDDING_VERSION + 1
						: CCIP_EMBEDDING_VERSION,
				mediaModifiedAt:
					state === "stale" ? new Date(modifiedAt.getTime() - 1) : modifiedAt,
				extractedAt: modifiedAt,
			});
			if (state === "precision") {
				await database
					.update(schema.medias)
					.set({ modifiedAt: sql`'2026-01-01 00:00:00.123456'::timestamp` })
					.where(eq(schema.medias.id, mediaId));
				await database
					.update(schema.ccipEmbeddings)
					.set({
						mediaModifiedAt: sql`'2026-01-01 00:00:00.123789'::timestamp`,
					})
					.where(eq(schema.ccipEmbeddings.regionId, regionId));
			}
		}
		expect(await countCcipTargets(database, { mediaSourceId: local })).toBe(5);
		expect(await countCcipTargets(database, {})).toBe(6);
		expect(
			await countCcipTargets(database, { mediaSourceId: local, force: true }),
		).toBe(7);
		expect(await countCcipTargets(database, { force: true })).toBe(8);
		expect(
			await countCcipTargets(database, { mediaSourceId: randomUUID() }),
		).toBe(0);
	});
});

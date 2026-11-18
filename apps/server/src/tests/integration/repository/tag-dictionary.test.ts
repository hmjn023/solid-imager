import { relations, createRepositories } from "@solid-imager/db";
import * as schema from "@solid-imager/db/schema";
import {
	TAG_DICTIONARY_JOB,
	type TagDictionaryTagRow,
} from "@solid-imager/core/tags";
import { drizzle } from "drizzle-orm/pglite";
import { eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it, vi } from "vitest";
import { call } from "@orpc/server";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { db as workerDb } from "~/infrastructure/db";
import { createPglite } from "~/infrastructure/db/pglite";
import { startTagDictionarySchedule } from "~/infrastructure/services/tag-dictionary-service";
import {
	ATTRIBUTES_VERSION,
	WIKI_VERSION,
} from "~/infrastructure/services/tag-dictionary-sources";
import { MIGRATIONS_DIR } from "../../paths";

const tag: TagDictionaryTagRow = {
	name: "wavy_hair",
	category: 0,
	postCount: 100,
	japanese: "ウェーブヘア",
	aliases: ["waved_hair"],
	searchText: "wavy hair\nwaved hair",
};

async function* batch<T>(data: T[]) {
	yield data;
}

it("serializes refresh jobs and preserves the searchable snapshot on failure or stale redelivery", async () => {
	const client = createPglite();
	try {
		const db = drizzle({ client, relations });
		await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
		const { job, tagDictionary } = createRepositories(() => db, {
			info() {},
			error() {},
		});
		const payload = { trigger: "manual" };
		const type = TAG_DICTIONARY_JOB;
		const cancelledId = await tagDictionary.queueRefresh({ trigger: "manual" });
		expect(cancelledId).not.toBeNull();
		await db
			.update(schema.jobs)
			.set({
				status: "cancelled",
				finishedAt: new Date(0),
				updatedAt: new Date(0),
			})
			.where(eq(schema.jobs.id, cancelledId ?? ""));
		const automatic = {
			trigger: "automatic" as const,
			completedBefore: new Date(),
			retryBefore: new Date(),
		};
		expect(await tagDictionary.queueRefresh(automatic)).toBeNull();
		const queued = await job.createIfUnique({ type, payload });
		expect(queued).not.toBeNull();
		expect(await job.createIfUnique({ type, payload })).toBeNull();
		const [running] = await job.claimPending(1, { includeTypes: [type] });
		const attempt = { id: running.id, number: running.attemptCount ?? 0 };
		expect(running.id).toBe(queued?.id);
		expect(await job.createIfUnique({ type, payload })).toBeNull();
		await tagDictionary.replace(
			{ source: "tags", rows: [[tag]] },
			"tag-v1",
			attempt,
		);
		await tagDictionary.replace(
			{
				source: "wiki",
				rows: batch([
					{
						name: tag.name,
						body: "Hair that falls in waves.",
						otherNames: ["波状の髪"],
						updatedAt: "2026-06-01T00:00:00.000Z",
					},
				]),
			},
			"wiki-v1",
			attempt,
		);
		await tagDictionary.replace(
			{
				source: "attributes",
				rows: batch([
					{
						name: tag.name,
						attributes: ["头发", "发型"],
					},
				]),
			},
			"attributes-v1",
			attempt,
		);

		for (const query of ["wavy hair", "waved_hair"]) {
			const { items } = await tagDictionary.search({
				query,
				category: 0,
				offset: 0,
			});
			expect(items[0]).toMatchObject({
				name: tag.name,
				attributes: ["头发", "发型"],
			});
		}
		for (const query of ["ウェーブヘア", "波状の髪"]) {
			expect((await tagDictionary.search({ query, offset: 0 })).items).toEqual(
				[],
			);
		}
		expect(
			(await tagDictionary.search({ query: "_", category: 1, offset: 0 }))
				.items,
		).toEqual([]);
		expect((await tagDictionary.detail(tag.name))?.body).toBe(
			"Hair that falls in waves.",
		);
		expect(await tagDictionary.detail("waved_hair")).toMatchObject({
			name: tag.name,
			japanese: "ウェーブヘア",
			wikiNames: ["波状の髪"],
		});
		await expect(
			tagDictionary.replace({ source: "tags", rows: [] }, "tag-v2", attempt),
		).rejects.toThrow("Empty tag dictionary snapshot");
		expect((await tagDictionary.status()).snapshots).toContainEqual(
			expect.objectContaining({ version: "tag-v1", count: 1 }),
		);

		await db
			.update(schema.jobs)
			.set({ updatedAt: new Date(0) })
			.where(eq(schema.jobs.id, running.id));
		expect(await job.requeueStaleInProgress(new Date())).toBe(1);
		const [redelivered] = await job.claimPending(1, { includeTypes: [type] });
		expect(redelivered.attemptCount).toBe(attempt.number + 1);
		await expect(
			tagDictionary.replace(
				{ source: "tags", rows: [[{ ...tag, name: "new_tag" }]] },
				"tag-v3",
				attempt,
			),
		).rejects.toThrow("attempt ended");
		expect(await tagDictionary.detail(tag.name)).not.toBeNull();

		await job.finishAttempt(redelivered.id, redelivered.attemptCount ?? 0, {
			status: "completed",
			result: {},
		});
		expect((await tagDictionary.status()).job?.status).toBe("completed");
		expect(await job.createIfUnique({ type, payload })).not.toBeNull();
	} finally {
		await client.close();
	}
});

it("automatically merges exact aliases and preserves old assignments and searches after manual migration", async () => {
	const client = createPglite();
	try {
		const db = drizzle({ client, relations });
		await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
		const {
			job,
			tagDictionary,
			tag: library,
			media,
		} = createRepositories(() => db, {
			info() {},
			error() {},
		});
		const [source] = await db
			.insert(schema.mediaSources)
			.values({
				type: "local",
				name: "Migration images",
				connectionInfo: { path: "/isolated" },
			})
			.returning();
		const [image] = await db
			.insert(schema.medias)
			.values({
				mediaSourceId: source.id,
				fileName: "hair.png",
				filePath: "hair.png",
				mediaType: "image",
				width: 10,
				height: 10,
			})
			.returning();
		const target = await library.create({
			name: tag.name,
			description: "Canonical description",
		});
		const old = await library.create({ name: "waved_hair", attribute: "hair" });
		const custom = await library.create({ name: "my_brush" });
		const ambiguous = await library.create({ name: "ambiguous_hair" });
		const localized = await library.create({ name: "ウェーブヘア" });
		await library.addTagsToMedia(
			image.id,
			[{ name: target.name, type: "positive", confidence: 0.8 }],
			"AI",
		);
		await library.addTagsToMedia(image.id, [
			{ name: old.name, type: "positive" },
			{ name: old.name, type: "negative" },
		]);
		const other = await library.create({
			name: "braid_legacy",
			color: "#808080",
		});
		await library.addTagsToMedia(image.id, [
			{ name: other.name, type: "positive" },
		]);
		await job.createIfUnique({
			type: TAG_DICTIONARY_JOB,
			payload: { trigger: "manual" },
		});
		const [running] = await job.claimPending(1, {
			includeTypes: [TAG_DICTIONARY_JOB],
		});
		const attempt = { id: running.id, number: running.attemptCount ?? 0 };
		await tagDictionary.replace(
			{
				source: "tags",
				rows: [
					[
						{ ...tag, aliases: [...tag.aliases, ambiguous.name] },
						{
							...tag,
							name: "braided_hair",
							aliases: [other.name, ambiguous.name, tag.name],
						},
						{ ...tag, name: "unused_dictionary_tag", aliases: [] },
					],
				],
			},
			"v1",
			attempt,
		);
		await expect(
			tagDictionary.reconcileLegacy({ ...attempt, number: attempt.number + 1 }),
		).rejects.toThrow("attempt ended");
		expect(await library.findById(old.id)).not.toBeNull();
		await tagDictionary.reconcileLegacy(attempt);
		await tagDictionary.reconcileLegacy(attempt);
		expect(await library.findById(old.id)).toBeNull();
		expect(await library.findById(target.id)).toMatchObject({
			name: target.name,
			description: "Canonical description",
			attribute: "hair",
		});
		expect(await library.findById(other.id)).toMatchObject({
			name: "braided_hair",
			color: "#808080",
		});
		expect((await tagDictionary.detail(tag.name))?.name).toBe(tag.name);
		expect(await tagDictionary.detail(ambiguous.name)).toBeNull();
		expect(
			(await tagDictionary.listLegacy({ query: "", offset: 0 })).items,
		).toEqual(
			expect.arrayContaining(
				[ambiguous, custom, localized].map(({ id, name }) => ({ id, name })),
			),
		);
		expect(await library.findByName("unused_dictionary_tag")).toBeNull();
		expect(
			(await library.findByMediaId(image.id)).filter(
				(assignment) => assignment.id === target.id,
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "positive",
					confidence: null,
					source: "manual",
				}),
				expect.objectContaining({ type: "negative", confidence: null }),
			]),
		);
		expect(
			await tagDictionary.migrateLegacy({
				tagId: custom.id,
				sourceName: custom.name,
				target: "missing",
			}),
		).toBe(false);
		expect(
			await tagDictionary.migrateLegacy({
				tagId: target.id,
				sourceName: target.name,
				target: "braided_hair",
			}),
		).toBe(false);
		const migration = {
			tagId: custom.id,
			sourceName: custom.name,
			target: tag.name,
		};
		expect(
			await tagDictionary.migrateLegacy({
				...migration,
				sourceName: "stale_name",
			}),
		).toBe(false);
		expect(await tagDictionary.migrateLegacy(migration)).toBe(true);
		expect(await tagDictionary.migrateLegacy(migration)).toBe(false);
		await library.addTagsToMedia(
			image.id,
			[
				{ name: custom.name, type: "positive", confidence: 0.9 },
				{ name: old.name, type: "positive", confidence: 0.6 },
				{ name: target.name, type: "positive", confidence: 0.75 },
			],
			"AI",
		);
		expect(await library.findById(custom.id)).toBeNull();
		expect(await library.findByName(old.name)).toBeNull();
		for (const term of [old.name, custom.name, target.name]) {
			for (const operator of ["equals", "in"] as const) {
				const result = await media.search(source.id, {
					condition: {
						type: "group",
						operator: "and",
						children: [
							{
								type: "criterion",
								target: "tag",
								operator,
								value: operator === "in" ? [term] : term,
							},
						],
					},
					offset: 0,
					order: "desc",
				});
				expect(result.media.map(({ id }) => id)).toEqual([image.id]);
			}
		}
		expect(
			await db
				.select()
				.from(schema.relatedTagFrequencies)
				.where(eq(schema.relatedTagFrequencies.tagId, target.id)),
		).toEqual([{ tagId: target.id, imageCount: 1 }]);
	} finally {
		await client.close();
	}
});

it("keeps positive tag edits atomic across migrations and preserves negative assignments", async () => {
	const client = createPglite();
	try {
		const db = drizzle({ client, relations });
		await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
		const {
			tagDictionary,
			tag: library,
			media,
		} = createRepositories(() => db, { info() {}, error() {} });
		const [source] = await db
			.insert(schema.mediaSources)
			.values({
				type: "local",
				name: "Tag editing",
				connectionInfo: { path: "/isolated" },
			})
			.returning();
		const [image] = await db
			.insert(schema.medias)
			.values({
				mediaSourceId: source.id,
				fileName: "sample.png",
				filePath: "sample.png",
				mediaType: "image",
				width: 10,
				height: 10,
			})
			.returning();
		await db.insert(schema.tagDictionaryTags).values([
			{ ...tag, name: "blue_hair", aliases: [], searchText: "blue hair" },
			{ ...tag, name: "cyan_hair", aliases: [], searchText: "cyan hair" },
		]);
		const old = await library.create({ name: "Blue Hair" });
		const shared = await library.create({ name: "shared_tag" });
		const expected = [
			{ id: old.id, name: old.name },
			{ id: shared.id, name: shared.name },
		];
		await library.addTagsToMedia(image.id, [
			{ name: old.name, type: "positive" },
			{ name: shared.name, type: "positive" },
			{ name: shared.name, type: "negative" },
		]);

		const edit = {
			mediaId: image.id,
			mediaSourceId: source.id,
			expected,
			entries: [{ name: "blue_hair", fromDictionary: true }],
		};
		await expect(
			media.updatePositiveTags({
				...edit,
				entries: [{ name: "unknown", fromDictionary: true }],
			}),
		).rejects.toThrow("dictionary changed");
		expect(await library.findByMediaId(image.id)).toHaveLength(3);
		await media.updatePositiveTags(edit);
		expect(await library.findByMediaId(image.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: old.id,
					name: old.name,
					type: "positive",
				}),
				expect.objectContaining({
					id: shared.id,
					name: shared.name,
					type: "negative",
				}),
			]),
		);
		expect(await library.findByName("blue_hair")).toBeNull();
		const beforeRename = [{ id: old.id, name: old.name }];
		expect(
			await tagDictionary.migrateLegacy({
				tagId: old.id,
				sourceName: old.name,
				target: "cyan_hair",
			}),
		).toBe(true);
		await expect(
			media.updatePositiveTags({ ...edit, expected: beforeRename }),
		).rejects.toThrow("changed since editing began");
		expect(await library.findByMediaId(image.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: old.id,
					name: "cyan_hair",
					type: "positive",
				}),
				expect.objectContaining({
					id: shared.id,
					name: shared.name,
					type: "negative",
				}),
			]),
		);

		// The previous alias can be selected as an independent official name in a new snapshot.
		const promoted = await library.create({ name: "promoted_alias" });
		await library.addTagsToMedia(image.id, [
			{ name: promoted.name, type: "positive" },
		]);
		expect(
			await tagDictionary.migrateLegacy({
				tagId: promoted.id,
				sourceName: promoted.name,
				target: "cyan_hair",
			}),
		).toBe(true);
		await expect(
			media.bulkRemoveTags([image.id], [promoted.id]),
		).rejects.toThrow("tags changed");
		await db.insert(schema.tagDictionaryTags).values({
			...tag,
			name: promoted.name,
			aliases: [],
			searchText: "promoted alias",
		});
		await media.updatePositiveTags({
			...edit,
			expected: [{ id: old.id, name: "cyan_hair" }],
			entries: [{ name: promoted.name, fromDictionary: true }],
		});
		expect(await library.findByMediaId(image.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: promoted.name, type: "positive" }),
				expect.objectContaining({
					id: shared.id,
					name: shared.name,
					type: "negative",
				}),
			]),
		);
		expect(
			await db
				.select()
				.from(schema.tagNameRedirects)
				.where(eq(schema.tagNameRedirects.name, promoted.name)),
		).toEqual([{ name: promoted.name, tagId: old.id }]);
	} finally {
		await client.close();
	}
});

it("reports real update-job outcomes and retries an overdue failure with the worker", async () => {
	await workerDb.insert(schema.tagDictionarySnapshots).values([
		{ source: "wiki", version: WIKI_VERSION, count: 1 },
		{ source: "attributes", version: ATTRIBUTES_VERSION, count: 1 },
	]);
	let generatedAt = "2026-11-16T11:00:00Z";
	let tagName = "wavy hair";
	let upstreamCount = 1;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL) => {
			const url = String(input);
			if (url.endsWith("/meta.json")) {
				return Response.json({
					generated_at: generatedAt,
					tag_count_total: upstreamCount,
				});
			}
			if (url.endsWith("/tags.json")) {
				return Response.json([
					{
						t: tagName,
						c: 0,
						cnt: 100,
						ja: "ウェーブヘア",
						a: ["old_worker_tag"],
					},
				]);
			}
			throw new Error(`Unexpected dictionary source ${url}`);
		}),
	);

	const status = () => call(tagsRouter.dictionaryStatus);
	const refresh = () => call(tagsRouter.dictionaryRefresh);
	let stopSchedule: (() => void) | undefined;
	try {
		const first = await refresh();
		await vi.waitFor(
			async () => {
				expect((await status()).job).toMatchObject({
					id: first.jobId,
					status: "completed",
				});
			},
			{ timeout: 10_000 },
		);
		expect((await status()).snapshots).toContainEqual(
			expect.objectContaining({
				source: "tags",
				version: generatedAt,
				count: 1,
			}),
		);
		const [legacy] = await workerDb
			.insert(schema.tags)
			.values({ name: "old_worker_tag" })
			.returning();
		const latest = await refresh();
		await vi.waitFor(
			async () => {
				expect((await status()).job).toMatchObject({
					id: latest.jobId,
					status: "completed",
				});
			},
			{ timeout: 10_000 },
		);
		expect(
			(
				await workerDb
					.select()
					.from(schema.tags)
					.where(eq(schema.tags.id, legacy.id))
			)[0]?.name,
		).toBe("wavy_hair");

		generatedAt = "2026-11-23T11:00:00Z";
		tagName = "braided hair";
		upstreamCount = 2;
		const failed = await refresh();
		await vi.waitFor(
			async () => {
				expect((await status()).job).toMatchObject({
					id: failed.jobId,
					status: "failed",
				});
			},
			{ timeout: 10_000 },
		);
		expect(
			(await call(tagsRouter.dictionarySearch, { query: "wavy hair" })).items[0]
				?.name,
		).toBe("wavy_hair");

		await workerDb
			.update(schema.jobs)
			.set({
				finishedAt: sql`now() - interval '2 days'`,
				updatedAt: sql`now() - interval '2 days'`,
			})
			.where(eq(schema.jobs.id, failed.jobId ?? ""));
		await workerDb
			.update(schema.jobs)
			.set({
				finishedAt: sql`now() - interval '3 days'`,
				updatedAt: sql`now() - interval '3 days'`,
			})
			.where(inArray(schema.jobs.id, [first.jobId ?? "", latest.jobId ?? ""]));
		upstreamCount = 1;
		stopSchedule = startTagDictionarySchedule();
		await vi.waitFor(
			async () => {
				const refreshed = await status();
				expect(refreshed.job?.status).toBe("completed");
				expect(refreshed.snapshots).toContainEqual(
					expect.objectContaining({
						source: "tags",
						version: generatedAt,
						count: 1,
					}),
				);
			},
			{ timeout: 10_000 },
		);
		expect(
			(await call(tagsRouter.dictionarySearch, { query: "braided_hair" }))
				.items[0]?.name,
		).toBe("braided_hair");
	} finally {
		stopSchedule?.();
		vi.unstubAllGlobals();
	}
}, 30_000);

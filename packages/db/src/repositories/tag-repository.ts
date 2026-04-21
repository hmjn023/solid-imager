import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { MediaTag } from "@solid-imager/core/domain/media/schemas";
import type {
	NewTag,
	Tag,
	TagRepository as TagRepositoryDef,
	UpdateTag,
} from "@solid-imager/core/domain/repositories/tag-repository";
import { tagResponseSchema } from "@solid-imager/core/domain/tags/schemas";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { mediaTags, tags } from "../schema";
import type { DrizzleExecutor } from "../types";

export type TagRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;
export type TagRepositoryTransactionRunner = <T>(
	callback: (tx: unknown) => Promise<T>,
) => Promise<T>;

type CreateTagRepositoryOptions = {
	orderByName?: boolean;
	transaction?: TagRepositoryTransactionRunner;
};

type MediaTagResult = typeof tags.$inferSelect & {
	type: "positive" | "negative";
	confidence: number | null;
	associationSource: string;
};

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

function mapToTag(row: typeof tags.$inferSelect): Tag {
	return tagResponseSchema.parse({
		id: row.id,
		name: row.name,
		description: row.description,
		attribute: row.attribute,
		color: row.color,
		source: row.source,
		authorId: row.authorId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

function mapToMediaTag(row: MediaTagResult): MediaTag {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		attribute: row.attribute,
		color: row.color,
		source: row.associationSource,
		authorId: row.authorId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		type: row.type,
		confidence: row.confidence,
	};
}

function mediaTagConflictSet(source: string) {
	let sourceUpdateSql = sql`excluded.source`;
	let confidenceUpdateSql = sql`excluded.confidence`;

	if (source === "AI") {
		sourceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.source ELSE media_tags.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.confidence ELSE media_tags.confidence END`;
	} else if (source === "manual") {
		sourceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.source ELSE media_tags.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_tags.confidence END`;
	}

	return {
		source: sourceUpdateSql,
		confidence: confidenceUpdateSql,
	};
}

export function createTagRepository(
	getExecutor: TagRepositoryExecutorProvider,
	options: CreateTagRepositoryOptions = {},
): TagRepositoryDef {
	return {
		async findAll(): Promise<Tag[]> {
			try {
				const query = getExecutor().select().from(tags);
				const rows = options.orderByName
					? await query.orderBy(asc(tags.name))
					: await query;
				return rows.map(mapToTag);
			} catch (error) {
				throw new UnexpectedError("Failed to select tags", error);
			}
		},

		async findById(id: string): Promise<Tag | null> {
			try {
				const rows = await getExecutor()
					.select()
					.from(tags)
					.where(eq(tags.id, id))
					.limit(1);
				return rows[0] ? mapToTag(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(`Failed to select tag by ID: ${id}`, error);
			}
		},

		async findByName(name: string): Promise<Tag | null> {
			try {
				const rows = await getExecutor()
					.select()
					.from(tags)
					.where(eq(tags.name, name))
					.limit(1);
				return rows[0] ? mapToTag(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select tag by name: ${name}`,
					error,
				);
			}
		},

		async create(input: NewTag, tx?: unknown): Promise<Tag> {
			try {
				const rows = await getExecutor(tx)
					.insert(tags)
					.values({
						name: input.name,
						description: input.description ?? null,
						attribute: input.attribute ?? null,
						color: input.color ?? null,
						source: input.source ?? "manual",
					})
					.returning();
				return mapToTag(rows[0]);
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						`Tag with name '${input.name}' already exists`,
					);
				}
				throw new UnexpectedError("Failed to insert tag", error);
			}
		},

		async update(id: string, input: UpdateTag, tx?: unknown): Promise<Tag> {
			try {
				const rows = await getExecutor(tx)
					.update(tags)
					.set({
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.description !== undefined
							? { description: input.description ?? null }
							: {}),
						...(input.attribute !== undefined
							? { attribute: input.attribute ?? null }
							: {}),
						...(input.color !== undefined
							? { color: input.color ?? null }
							: {}),
						...(input.source !== undefined ? { source: input.source } : {}),
						updatedAt: new Date(),
					})
					.where(eq(tags.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Tag", id);
				}
				return mapToTag(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						`Tag with name '${input.name}' already exists`,
					);
				}
				throw new UnexpectedError(`Failed to update tag with ID: ${id}`, error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(tx)
					.delete(tags)
					.where(eq(tags.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Tag", id);
				}
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(`Failed to delete tag with ID: ${id}`, error);
			}
		},

		async findByMediaId(mediaId: string, tx?: unknown): Promise<MediaTag[]> {
			try {
				const rows = await getExecutor(tx)
					.select({
						id: tags.id,
						name: tags.name,
						description: tags.description,
						attribute: tags.attribute,
						color: tags.color,
						source: tags.source,
						authorId: tags.authorId,
						createdAt: tags.createdAt,
						updatedAt: tags.updatedAt,
						type: mediaTags.tagType,
						confidence: mediaTags.confidence,
						associationSource: mediaTags.source,
					})
					.from(mediaTags)
					.innerJoin(tags, eq(mediaTags.tagId, tags.id))
					.where(eq(mediaTags.mediaId, mediaId));

				return rows.map(mapToMediaTag);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to retrieve tags for media ID: ${mediaId}`,
					error,
				);
			}
		},

		async addTagsToMedia(
			mediaId: string,
			tagsToInsert: {
				name: string;
				type: "positive" | "negative";
				confidence?: number;
			}[],
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			try {
				const execute = async (innerTx?: unknown): Promise<void> => {
					const client = getExecutor(innerTx);
					const uniqueTagNames = Array.from(
						new Set(tagsToInsert.map((tag) => tag.name)),
					);
					if (uniqueTagNames.length === 0) {
						return;
					}

					await client
						.insert(tags)
						.values(uniqueTagNames.map((name) => ({ name, source })))
						.onConflictDoNothing();

					const allTags = await client
						.select()
						.from(tags)
						.where(inArray(tags.name, uniqueTagNames));

					const tagMap = new Map(allTags.map((tag) => [tag.name, tag]));
					const rows = tagsToInsert.map((tagToInsert) => {
						const foundTag = tagMap.get(tagToInsert.name);
						if (!foundTag) {
							throw new Error(
								`Tag ${tagToInsert.name} not found after insertion`,
							);
						}
						return {
							mediaId,
							tagId: foundTag.id,
							tagType: tagToInsert.type,
							confidence: tagToInsert.confidence ?? null,
							source,
						};
					});

					if (rows.length === 0) {
						return;
					}

					await client
						.insert(mediaTags)
						.values(rows)
						.onConflictDoUpdate({
							target: [mediaTags.mediaId, mediaTags.tagId, mediaTags.tagType],
							set: mediaTagConflictSet(source),
						});
				};

				if (tx) {
					await execute(tx);
					return;
				}
				if (options.transaction) {
					await options.transaction(execute);
					return;
				}
				await execute();
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						"One or more media tags already exist",
					);
				}
				throw new UnexpectedError(
					`Failed to insert media tags for media ID: ${mediaId}`,
					error,
				);
			}
		},
	};
}

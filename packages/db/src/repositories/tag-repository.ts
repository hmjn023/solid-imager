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
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";
import { eq, type InferSelectModel, inArray, sql } from "drizzle-orm";
import { mediaTags, tags } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbTag = InferSelectModel<typeof tags>;

function mapTag(dbTag: DbTag): Tag {
	return {
		id: dbTag.id,
		name: dbTag.name,
		description: dbTag.description,
		attribute: dbTag.attribute,
		color: dbTag.color,
		source: dbTag.source,
		authorId: dbTag.authorId,
		createdAt: dbTag.createdAt,
		updatedAt: dbTag.updatedAt,
	};
}

type MediaTagResult = {
	id: string;
	name: string;
	description: string | null;
	attribute: string | null;
	color: string | null;
	source: string;
	authorId: string | null;
	createdAt: Date;
	updatedAt: Date;
	type: "positive" | "negative";
	confidence: number | null;
};

function mapMediaTag(row: MediaTagResult): MediaTag {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		attribute: row.attribute,
		color: row.color,
		source: row.source,
		authorId: row.authorId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		type: row.type,
		confidence: row.confidence,
	};
}

export function createTagRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): TagRepositoryDef {
	return {
		async findAll(): Promise<Tag[]> {
			try {
				const results = await getExecutor().select().from(tags);
				return results.map(mapTag);
			} catch (error) {
				throw new UnexpectedError("Failed to select tags", error);
			}
		},

		async findById(id: string): Promise<Tag | null> {
			try {
				const result = await getExecutor()
					.select()
					.from(tags)
					.where(eq(tags.id, id));
				if (result.length === 0) {
					return null;
				}
				return mapTag(result[0]);
			} catch (error) {
				throw new UnexpectedError(`Failed to select tag by ID: ${id}`, error);
			}
		},

		async findByName(name: string): Promise<Tag | null> {
			try {
				const result = await getExecutor()
					.select()
					.from(tags)
					.where(eq(tags.name, name));
				if (result.length === 0) {
					return null;
				}
				return mapTag(result[0]);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select tag by name: ${name}`,
					error,
				);
			}
		},

		async create(tag: NewTag, tx?: unknown): Promise<Tag> {
			try {
				const result = await getExecutor(tx)
					.insert(tags)
					.values(tag)
					.returning();
				return mapTag(result[0]);
			} catch (error: unknown) {
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					(error as { code: string }).code === "23505"
				) {
					throw new ResourceConflictError(
						`Tag with name '${tag.name}' already exists`,
					);
				}
				throw new UnexpectedError("Failed to insert tag", error);
			}
		},

		async update(id: string, tag: UpdateTag, tx?: unknown): Promise<Tag> {
			try {
				const result = await getExecutor(tx)
					.update(tags)
					.set(tag)
					.where(eq(tags.id, id))
					.returning();

				if (result.length === 0) {
					throw new ResourceNotFoundError("Tag", id);
				}
				return mapTag(result[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					(error as { code: string }).code === "23505"
				) {
					throw new ResourceConflictError(
						`Tag with name '${tag.name}' already exists`,
					);
				}
				throw new UnexpectedError(`Failed to update tag with ID: ${id}`, error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const result = await getExecutor(tx)
					.delete(tags)
					.where(eq(tags.id, id))
					.returning();

				if (result.length === 0) {
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
				const result = await getExecutor(tx)
					.select({
						id: tags.id,
						name: tags.name,
						description: tags.description,
						attribute: tags.attribute,
						color: tags.color,
						source: mediaTags.source,
						authorId: tags.authorId,
						createdAt: tags.createdAt,
						updatedAt: tags.updatedAt,
						type: mediaTags.tagType,
						confidence: mediaTags.confidence,
					})
					.from(mediaTags)
					.innerJoin(tags, eq(mediaTags.tagId, tags.id))
					.where(eq(mediaTags.mediaId, mediaId));

				return result.map(mapMediaTag);
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
				const execute = async (exec: DrizzleExecutor) => {
					const uniqueTagNames = Array.from(
						new Set(tagsToInsert.map((tag) => tag.name)),
					);
					if (uniqueTagNames.length === 0) {
						return;
					}

					await exec
						.insert(tags)
						.values(uniqueTagNames.map((name) => ({ name, source })))
						.onConflictDoNothing();

					const allTags = await exec
						.select()
						.from(tags)
						.where(inArray(tags.name, uniqueTagNames));

					const allTagsMap = new Map(allTags.map((t) => [t.name, t]));
					const mediaTagsToInsert = tagsToInsert.map((tagToInsert) => {
						const foundTag = allTagsMap.get(tagToInsert.name);
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

					if (mediaTagsToInsert.length > 0) {
						let sourceUpdateSql = sql`excluded.source`;
						let confidenceUpdateSql = sql`excluded.confidence`;

						if (source === "AI") {
							sourceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.source ELSE media_tags.source END`;
							confidenceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.confidence ELSE media_tags.confidence END`;
						} else if (source === "manual") {
							sourceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.source ELSE media_tags.source END`;
							confidenceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_tags.confidence END`;
						}

						await exec
							.insert(mediaTags)
							.values(mediaTagsToInsert)
							.onConflictDoUpdate({
								target: [mediaTags.mediaId, mediaTags.tagId, mediaTags.tagType],
								set: {
									confidence: confidenceUpdateSql,
									source: sourceUpdateSql,
								},
							});
					}
				};

				if (tx) {
					await execute(getExecutor(tx));
				} else {
					await getExecutor().transaction((innerTx) => execute(innerTx));
				}
			} catch (error) {
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					(error as { code: string }).code === "23505"
				) {
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

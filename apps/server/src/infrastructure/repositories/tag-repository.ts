import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { MediaTag } from "@solid-imager/core/domain/media/schemas";
import type {
	NewTag,
	Tag,
	TagRepository as TagRepositoryDef,
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";
import { getClient, type TransactionClient } from "@solid-imager/db";
import { mediaTags, tags } from "@solid-imager/db/schema";
import { eq, type InferSelectModel, inArray, sql } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";

type DbTag = InferSelectModel<typeof tags>;

function mapToDomain(dbTag: DbTag): Tag {
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

// Result type from join query
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

function mapToMediaTag(row: MediaTagResult): MediaTag {
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

export class DrizzleTagRepository implements TagRepositoryDef {
	async findAll(): Promise<Tag[]> {
		try {
			const results = await db.select().from(tags);
			return results.map(mapToDomain);
		} catch (error) {
			throw new UnexpectedError("Failed to select tags", error);
		}
	}

	async findById(id: string): Promise<Tag | null> {
		try {
			const result = await db.select().from(tags).where(eq(tags.id, id));
			if (result.length === 0) {
				return null;
			}
			return mapToDomain(result[0]);
		} catch (error) {
			throw new UnexpectedError(`Failed to select tag by ID: ${id}`, error);
		}
	}

	async findByName(name: string): Promise<Tag | null> {
		try {
			const result = await db.select().from(tags).where(eq(tags.name, name));
			if (result.length === 0) {
				return null;
			}
			return mapToDomain(result[0]);
		} catch (error) {
			throw new UnexpectedError(`Failed to select tag by name: ${name}`, error);
		}
	}

	async create(tag: NewTag, tx?: Transaction): Promise<Tag> {
		try {
			const client = getClient(db, tx);
			const result = await client.insert(tags).values(tag).returning();
			return mapToDomain(result[0]);
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
	}

	async update(id: string, tag: UpdateTag, tx?: Transaction): Promise<Tag> {
		try {
			const client = getClient(db, tx);
			const result = await client
				.update(tags)
				.set(tag)
				.where(eq(tags.id, id))
				.returning();

			if (result.length === 0) {
				throw new ResourceNotFoundError("Tag", id);
			}
			return mapToDomain(result[0]);
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
	}

	async delete(id: string, tx?: Transaction): Promise<void> {
		try {
			const client = getClient(db, tx);
			const result = await client
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
	}

	async findByMediaId(mediaId: string, tx?: Transaction): Promise<MediaTag[]> {
		try {
			const client = getClient(db, tx);
			const result = await client
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

			return result.map(mapToMediaTag);
		} catch (error) {
			throw new UnexpectedError(
				`Failed to retrieve tags for media ID: ${mediaId}`,
				error,
			);
		}
	}

	async addTagsToMedia(
		mediaId: string,
		tagsToInsert: {
			name: string;
			type: "positive" | "negative";
			confidence?: number;
		}[],
		source = "manual",
		tx?: Transaction,
	): Promise<void> {
		try {
			// const _client = getClient(db, tx);
			const execute = async (t: Transaction) => {
				const uniqueTagNames = Array.from(
					new Set(tagsToInsert.map((tag) => tag.name)),
				);
				if (uniqueTagNames.length === 0) {
					return;
				}

				const client = t as unknown as TransactionClient;
				await client
					.insert(tags)
					.values(uniqueTagNames.map((name) => ({ name, source })))
					.onConflictDoNothing();

				// Fetch all tags (both existing and newly created)
				const allTags = await client
					.select()
					.from(tags)
					.where(inArray(tags.name, uniqueTagNames));

				const mediaTagsToInsert = tagsToInsert.map((tagToInsert) => {
					const foundTag = allTags.find((tag) => tag.name === tagToInsert.name);
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
					// Priority: comfyui_workflow > manual > AI
					// Update source and confidence ONLY if the new source has higher or equal priority
					// or if the current source is lower priority.
					// Since we can't easily express "if new is manual and old is AI" in a single static SQL statement
					// without extensive CASE WHENs that depend on the input row's source (which is constant per batch here but conceptually row-dependent),
					// we use a CASE statement.

					// Logic:
					// If existing is comfyui_workflow: NEVER update (unless new is also comfyui_workflow, then update confidence)
					// If existing is manual: Update if new is comfyui_workflow.
					// If existing is AI: Update if new is anything (manual, comfyui, or AI update).

					// However, `source` argument is constant for the whole batch.
					// We can simplify the logic based on the *input* source.

					let sourceUpdateSql = sql`excluded.source`;
					let confidenceUpdateSql = sql`excluded.confidence`;

					if (source === "AI") {
						// Only update if current is 'AI' (or implicitly if it didn't exist, which insert handles)
						// If current is 'manual' or 'comfyui_workflow', DO NOT update.
						sourceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.source ELSE media_tags.source END`;
						confidenceUpdateSql = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.confidence ELSE media_tags.confidence END`;
					} else if (source === "manual") {
						// Update if current is 'AI' or 'manual'.
						// If current is 'comfyui_workflow', DO NOT update.
						sourceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.source ELSE media_tags.source END`;
						confidenceUpdateSql = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_tags.confidence END`;
					}
					// If source is 'comfyui_workflow', it overrides everything (default behavior of upsert is fine, or we can be explicit)

					await (t as unknown as TransactionClient)
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
				await execute(tx);
			} else {
				await db.transaction(execute);
			}
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code: string }).code === "23505"
			) {
				throw new ResourceConflictError("One or more media tags already exist");
			}
			throw new UnexpectedError(
				`Failed to insert media tags for media ID: ${mediaId}`,
				error,
			);
		}
	}
}

export const TagRepository = new DrizzleTagRepository();

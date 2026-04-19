import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import {
	type NewTag,
	newTagSchema,
	type TagResponse,
	tagResponseSchema,
	type UpdateTag,
} from "@solid-imager/core/domain/tags/schemas";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import {
	mediaTags,
	tags,
} from "../../../../../server/src/infrastructure/db/schema";

function toTag(row: typeof tags.$inferSelect): TagResponse {
	return tagResponseSchema.parse(row);
}

export const TauriTagRepository = {
	async findAll(): Promise<TagResponse[]> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(tags)
			.orderBy(asc(tags.name));
		return rows.map(toTag);
	},

	async findById(id: string): Promise<TagResponse | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(tags)
			.where(eq(tags.id, id))
			.limit(1);
		return rows[0] ? toTag(rows[0]) : null;
	},

	async findByName(name: string): Promise<TagResponse | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(tags)
			.where(eq(tags.name, name))
			.limit(1);
		return rows[0] ? toTag(rows[0]) : null;
	},

	async create(input: NewTag): Promise<TagResponse> {
		const validated = newTagSchema.parse(input);
		const existing = await this.findByName(validated.name);
		if (existing) {
			throw new ResourceConflictError(
				`Tag with name '${validated.name}' already exists`,
			);
		}

		const rows = await getTauriAppServices()
			.db.insert(tags)
			.values({
				name: validated.name,
				description: validated.description ?? null,
				attribute: validated.attribute ?? null,
				color: validated.color ?? null,
				source: validated.source ?? "manual",
			})
			.returning();
		return toTag(rows[0]);
	},

	async update(id: string, input: UpdateTag): Promise<TagResponse> {
		const rows = await getTauriAppServices()
			.db.update(tags)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined
					? { description: input.description ?? null }
					: {}),
				...(input.attribute !== undefined
					? { attribute: input.attribute ?? null }
					: {}),
				...(input.color !== undefined ? { color: input.color ?? null } : {}),
				...(input.source !== undefined ? { source: input.source } : {}),
				updatedAt: new Date(),
			})
			.where(eq(tags.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Tag", id);
		}

		return toTag(rows[0]);
	},

	async addTagsToMedia(
		mediaId: string,
		tagsToInsert: {
			name: string;
			type: "positive" | "negative";
			confidence?: number;
		}[],
		source = "manual",
	): Promise<void> {
		const db = getTauriAppServices().db;
		const uniqueTagNames = [...new Set(tagsToInsert.map((t) => t.name))];
		if (uniqueTagNames.length === 0) return;

		await db
			.insert(tags)
			.values(uniqueTagNames.map((name) => ({ name, source })))
			.onConflictDoNothing();

		const allTags = await db
			.select()
			.from(tags)
			.where(inArray(tags.name, uniqueTagNames));

		const rows = tagsToInsert.map((t) => {
			const found = allTags.find((tag) => tag.name === t.name);
			if (!found) throw new Error(`Tag ${t.name} not found after insertion`);
			return {
				mediaId,
				tagId: found.id,
				tagType: t.type,
				confidence: t.confidence ?? null,
				source,
			};
		});

		if (rows.length === 0) return;

		let sourceSet = sql`excluded.source`;
		let confSet = sql`excluded.confidence`;
		if (source === "AI") {
			sourceSet = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.source ELSE media_tags.source END`;
			confSet = sql`CASE WHEN media_tags.source = 'AI' THEN excluded.confidence ELSE media_tags.confidence END`;
		} else if (source === "manual") {
			sourceSet = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.source ELSE media_tags.source END`;
			confSet = sql`CASE WHEN media_tags.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_tags.confidence END`;
		}

		await db
			.insert(mediaTags)
			.values(rows)
			.onConflictDoUpdate({
				target: [mediaTags.mediaId, mediaTags.tagId, mediaTags.tagType],
				set: { source: sourceSet, confidence: confSet },
			});
	},

	async delete(id: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(tags)
			.where(eq(tags.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Tag", id);
		}
	},
};

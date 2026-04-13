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
import { asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { tags } from "../../../../../server/src/infrastructure/db/schema";

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

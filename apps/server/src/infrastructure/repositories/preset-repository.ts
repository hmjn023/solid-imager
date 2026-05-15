import type {
	CreatePresetRequest,
	Preset,
	SearchGroup,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { presets } from "@solid-imager/db/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { db } from "~/infrastructure/db";

export class DrizzlePresetRepository implements PresetRepository {
	async list(): Promise<Preset[]> {
		const results = await db.select().from(presets).orderBy(presets.id);
		return results.map((row) => this.mapToEntity(row));
	}

	async get(id: number): Promise<Preset | null> {
		const results = await db
			.select()
			.from(presets)
			.where(eq(presets.id, id))
			.limit(1);
		return results.length > 0 ? this.mapToEntity(results[0]) : null;
	}

	async getByName(name: string): Promise<Preset | null> {
		const results = await db
			.select()
			.from(presets)
			.where(eq(presets.name, name))
			.limit(1);
		return results.length > 0 ? this.mapToEntity(results[0]) : null;
	}

	async create(data: CreatePresetRequest): Promise<Preset> {
		const results = await db
			.insert(presets)
			.values({
				name: data.name,
				value: data.value,
				sort: data.sort,
				order: data.order,
				mode: data.mode,
			})
			.returning();
		return this.mapToEntity(results[0]);
	}

	async update(id: number, data: UpdatePresetRequest): Promise<Preset | null> {
		const results = await db
			.update(presets)
			.set({
				...(data.name !== undefined ? { name: data.name } : {}),
				...(data.value !== undefined ? { value: data.value } : {}),
				...(data.sort !== undefined ? { sort: data.sort } : {}),
				...(data.order !== undefined ? { order: data.order } : {}),
				...(data.mode !== undefined ? { mode: data.mode } : {}),
			})
			.where(eq(presets.id, id))
			.returning();
		return results.length > 0 ? this.mapToEntity(results[0]) : null;
	}

	async delete(id: number): Promise<boolean> {
		const results = await db
			.delete(presets)
			.where(eq(presets.id, id))
			.returning();
		return results.length > 0;
	}

	private mapToEntity(row: InferSelectModel<typeof presets>): Preset {
		return {
			id: row.id,
			name: row.name,
			value: row.value as SearchGroup,
			sort: row.sort as Preset["sort"],
			order: row.order as Preset["order"],
			mode: row.mode as Preset["mode"],
			createdAt: row.createdAt,
		};
	}
}

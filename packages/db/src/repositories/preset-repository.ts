import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { searchGroupSchema } from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { eq, type InferSelectModel } from "drizzle-orm";
import { presets } from "../schema";
import type { DrizzleExecutor } from "../types";

export function createPresetRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): PresetRepository {
	function mapToEntity(row: InferSelectModel<typeof presets>): Preset {
		return {
			id: row.id,
			name: row.name,
			value: searchGroupSchema.parse(row.value),
			sort: row.sort as Preset["sort"],
			order: row.order as Preset["order"],
			mode: row.mode as Preset["mode"],
			createdAt: row.createdAt,
		};
	}

	return {
		async list(): Promise<Preset[]> {
			const rows = await getExecutor()
				.select()
				.from(presets)
				.orderBy(presets.id);
			return rows.map(mapToEntity);
		},

		async get(id: number): Promise<Preset | null> {
			const rows = await getExecutor()
				.select()
				.from(presets)
				.where(eq(presets.id, id))
				.limit(1);
			return rows.length > 0 ? mapToEntity(rows[0]) : null;
		},

		async getByName(name: string): Promise<Preset | null> {
			const rows = await getExecutor()
				.select()
				.from(presets)
				.where(eq(presets.name, name))
				.limit(1);
			return rows.length > 0 ? mapToEntity(rows[0]) : null;
		},

		async create(data: CreatePresetRequest): Promise<Preset> {
			const rows = await getExecutor()
				.insert(presets)
				.values({
					name: data.name,
					value: data.value,
					sort: data.sort,
					order: data.order,
					mode: data.mode,
				})
				.returning();
			return mapToEntity(rows[0]);
		},

		async update(
			id: number,
			data: UpdatePresetRequest,
		): Promise<Preset | null> {
			const rows = await getExecutor()
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
			return rows.length > 0 ? mapToEntity(rows[0]) : null;
		},

		async delete(id: number): Promise<boolean> {
			const rows = await getExecutor()
				.delete(presets)
				.where(eq(presets.id, id))
				.returning();
			return rows.length > 0;
		},
	};
}

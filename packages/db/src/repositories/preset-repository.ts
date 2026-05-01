import type {
	CreatePresetRequest,
	Preset,
	SearchGroup,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { presetSchema } from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { eq } from "drizzle-orm";
import { presets } from "../schema";
import type { DrizzleExecutor } from "../types";

export type PresetRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;

const validSorts = new Set(["date", "name", "size", "rating", "viewCount"]);
const validOrders = new Set(["asc", "desc"]);
const validModes = new Set(["simple", "pro"]);

function normalizeOptionalEnum<T extends string>(
	value: string | null,
	validValues: Set<T>,
): T | undefined {
	if (!value || !validValues.has(value as T)) {
		return;
	}
	return value as T;
}

function mapToPreset(row: typeof presets.$inferSelect): Preset {
	return presetSchema.parse({
		id: row.id,
		name: row.name,
		value: row.value as SearchGroup,
		sort: normalizeOptionalEnum(row.sort, validSorts),
		order: normalizeOptionalEnum(row.order, validOrders),
		mode: normalizeOptionalEnum(row.mode, validModes),
		createdAt: row.createdAt,
	});
}

export function createPresetRepository(
	getExecutor: PresetRepositoryExecutorProvider,
): PresetRepository {
	return {
		async list(): Promise<Preset[]> {
			const rows = await getExecutor().select().from(presets).orderBy(presets.id);
			return rows.map(mapToPreset);
		},

		async get(id: number): Promise<Preset | null> {
			const rows = await getExecutor().select().from(presets).where(eq(presets.id, id)).limit(1);
			return rows[0] ? mapToPreset(rows[0]) : null;
		},

		async getByName(name: string): Promise<Preset | null> {
			const rows = await getExecutor()
				.select()
				.from(presets)
				.where(eq(presets.name, name))
				.limit(1);
			return rows[0] ? mapToPreset(rows[0]) : null;
		},

		async create(input: CreatePresetRequest): Promise<Preset> {
			const rows = await getExecutor()
				.insert(presets)
				.values({
					name: input.name,
					value: input.value,
					sort: input.sort,
					order: input.order,
					mode: input.mode,
				})
				.returning();
			return mapToPreset(rows[0]);
		},

		async update(id: number, input: UpdatePresetRequest): Promise<Preset | null> {
			const rows = await getExecutor()
				.update(presets)
				.set({
					...(input.name !== undefined ? { name: input.name } : {}),
					...(input.value !== undefined ? { value: input.value } : {}),
					...(input.sort !== undefined ? { sort: input.sort } : {}),
					...(input.order !== undefined ? { order: input.order } : {}),
					...(input.mode !== undefined ? { mode: input.mode } : {}),
				})
				.where(eq(presets.id, id))
				.returning();
			return rows[0] ? mapToPreset(rows[0]) : null;
		},

		async delete(id: number): Promise<boolean> {
			const rows = await getExecutor().delete(presets).where(eq(presets.id, id)).returning();
			return rows.length > 0;
		},
	};
}

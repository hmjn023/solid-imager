import type {
	CreatePresetRequest,
	Preset,
	SearchGroup,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { presetSchema } from "@solid-imager/core/domain/media/schemas";
import { eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { presets } from "@solid-imager/db/schema";

const validSorts = new Set(["date", "name", "size", "rating", "viewCount"]);
const validOrders = new Set(["asc", "desc"]);
const validModes = new Set(["simple", "pro"]);

function normalizeOptionalEnum<T extends string>(
	value: string | null,
	validValues: Set<T>,
): T | undefined {
	if (!value || !validValues.has(value as T)) {
		return undefined;
	}
	return value as T;
}

function toPreset(row: typeof presets.$inferSelect): Preset {
	return presetSchema.parse({
		...row,
		value: row.value as SearchGroup,
		sort: normalizeOptionalEnum(row.sort, validSorts),
		order: normalizeOptionalEnum(row.order, validOrders),
		mode: normalizeOptionalEnum(row.mode, validModes),
	});
}

export const TauriPresetRepository = {
	async list(): Promise<Preset[]> {
		const rows = await getTauriAppServices().db.select().from(presets);
		return rows.map(toPreset);
	},

	async get(id: number): Promise<Preset | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(presets)
			.where(eq(presets.id, id))
			.limit(1);
		return rows[0] ? toPreset(rows[0]) : null;
	},

	async getByName(name: string): Promise<Preset | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(presets)
			.where(eq(presets.name, name))
			.limit(1);
		return rows[0] ? toPreset(rows[0]) : null;
	},

	async create(input: CreatePresetRequest): Promise<Preset> {
		const rows = await getTauriAppServices()
			.db.insert(presets)
			.values(input)
			.returning();
		return toPreset(rows[0]);
	},

	async update(id: number, input: UpdatePresetRequest): Promise<Preset | null> {
		const rows = await getTauriAppServices()
			.db.update(presets)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.value !== undefined ? { value: input.value } : {}),
				...(input.sort !== undefined ? { sort: input.sort } : {}),
				...(input.order !== undefined ? { order: input.order } : {}),
				...(input.mode !== undefined ? { mode: input.mode } : {}),
			})
			.where(eq(presets.id, id))
			.returning();
		return rows[0] ? toPreset(rows[0]) : null;
	},

	async delete(id: number): Promise<boolean> {
		const rows = await getTauriAppServices()
			.db.delete(presets)
			.where(eq(presets.id, id))
			.returning();
		return rows.length > 0;
	},
};

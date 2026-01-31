import { eq } from "drizzle-orm";
import type {
  CreatePresetRequest,
  Preset,
  SearchGroup,
  UpdatePresetRequest,
} from "~/domain/media/schemas";
import type { PresetRepository } from "~/domain/repositories/preset-repository";
import { db } from "~/infrastructure/db";
import { presets } from "~/infrastructure/db/schema";

export class DrizzlePresetRepository implements PresetRepository {
  async list(): Promise<Preset[]> {
    const results = await db.select().from(presets).orderBy(presets.id);
    return results.map(this.mapToEntity);
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

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle returns generic objects
  private mapToEntity(row: any): Preset {
    return {
      id: row.id,
      name: row.name,
      value: row.value as SearchGroup,
      createdAt: row.createdAt,
    };
  }
}

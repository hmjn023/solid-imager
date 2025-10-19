import { db } from "~/infrastructure/db/index";
import { presets } from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

type Preset = {
  id: string;
  name: string;
};

export const selectPresets = async () => {
  try {
    return await db.select().from(presets);
  } catch (error) {
    throw new UnknownDbError({ message: String(error) });
  }
};

export const insertPreset = async (preset: Preset) => {
  try {
    return await db.insert(presets).values(preset).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({ message: "Duplicate entry" });
    }
    throw new UnknownDbError({ message: String(error) });
  }
};

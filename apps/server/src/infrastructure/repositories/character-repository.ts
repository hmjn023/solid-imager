import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { createCharacterRepository } from "@solid-imager/db/repositories/character-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const DrizzleCharacterRepository: CharacterRepository =
	createCharacterRepository(getExecutor);

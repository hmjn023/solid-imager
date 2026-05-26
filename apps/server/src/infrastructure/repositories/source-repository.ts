import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const DrizzleSourceRepository: SourceRepository =
	createSourceRepository(getExecutor);

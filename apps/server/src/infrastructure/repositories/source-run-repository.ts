import { createSourceRunRepository } from "@solid-imager/db/repositories/source-run-repository";
import { getExecutor } from "~/infrastructure/db/executor";
export const SourceRunRepository = createSourceRunRepository(getExecutor);

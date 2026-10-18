import { createBatchRunRepository } from "@solid-imager/db/repositories/batch-run-repository";
import { getExecutor } from "~/infrastructure/db/executor";
export const BatchRunRepository = createBatchRunRepository(getExecutor);

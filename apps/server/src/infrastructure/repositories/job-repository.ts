import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const JobRepository: IJobRepository = createJobRepository(getExecutor);

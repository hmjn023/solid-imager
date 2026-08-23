import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import {
	allocateJobId as allocateDbJobId,
	createJobRepository,
} from "@solid-imager/db/repositories/job-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const JobRepository: IJobRepository = createJobRepository(getExecutor);

export function allocateJobId(): Promise<string> {
	return allocateDbJobId(getExecutor);
}

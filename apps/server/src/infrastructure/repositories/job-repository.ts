import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { services } from "~/infrastructure/service-registry";
import type { IJobRepository } from "@solid-imager/core/domain/repositories/job-repository";
import {
	allocateJobId as allocateDbJobId,
	createJobRepository,
} from "@solid-imager/db/repositories/job-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const JobRepository: IJobRepository = createJobRepository(
	getExecutor,
	() => processingSettingsFromConfig(services.getConfigService().getConfig()),
);

export function allocateJobId(): Promise<string> {
	return allocateDbJobId(getExecutor);
}

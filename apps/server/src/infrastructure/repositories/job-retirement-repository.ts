import { createJobRetirementRepository } from "@solid-imager/db/repositories/job-retirement-repository";
import { getExecutor } from "~/infrastructure/db/executor";
export const JobRetirementRepository =
	createJobRetirementRepository(getExecutor);

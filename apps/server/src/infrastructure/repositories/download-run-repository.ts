import { createDownloadRunRepository } from "@solid-imager/db/repositories/download-run-repository";
import { getExecutor } from "~/infrastructure/db/executor";
export const DownloadRunRepository = createDownloadRunRepository(getExecutor);

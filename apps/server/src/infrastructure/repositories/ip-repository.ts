import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { createIpRepository } from "@solid-imager/db/repositories/ip-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const IpRepository: IIpRepository = createIpRepository(getExecutor);

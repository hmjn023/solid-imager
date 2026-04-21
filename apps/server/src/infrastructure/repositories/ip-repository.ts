import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { createIpRepository } from "@solid-imager/db/repositories/ip-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db";

export const IpRepository: IIpRepository = createIpRepository(
	(tx) => (tx ?? db) as DrizzleExecutor,
);

import { createIpService } from "@solid-imager/application/ips";
import { IpRepository } from "~/infrastructure/db/repositories";

export const IpService = createIpService(IpRepository);

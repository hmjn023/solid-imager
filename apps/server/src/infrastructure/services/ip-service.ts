import { createIpService } from "@solid-imager/application/services/ip-service";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";

export const IpService = createIpService(IpRepository);

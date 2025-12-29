import type { Ip, NewIp, UpdateIp } from "~/domain/ips/schemas";

export type IpRepository = {
  findAll(): Promise<Ip[]>;
  findById(id: string): Promise<Ip | null>;
  create(ip: NewIp): Promise<Ip>;
  update(id: string, ip: UpdateIp): Promise<Ip>;
  delete(id: string): Promise<void>;
};

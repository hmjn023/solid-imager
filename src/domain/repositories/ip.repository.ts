import type { Ip, NewIp, UpdateIp } from "~/domain/ips/schemas";

// biome-ignore lint/style/useNamingConvention: Interface naming
export type IIpRepository = {
  findAll(): Promise<Ip[]>;
  findById(id: string): Promise<Ip | null>;
  create(ip: NewIp): Promise<Ip>;
  update(id: string, ip: UpdateIp): Promise<Ip>;
  delete(id: string): Promise<void>;

  // Associations
  findByMediaId(mediaId: string): Promise<Ip[]>;
  addMedia(mediaId: string, ipId: string): Promise<void>;
  removeMedia(mediaId: string, ipId: string): Promise<void>;
};

import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type { Ip, NewIp, UpdateIp } from "@/domain/ips/schemas";

export type IIpRepository = {
  findAll(): Promise<Ip[]>;
  findById(id: string, tx?: Transaction): Promise<Ip | null>;
  findByName(name: string, tx?: Transaction): Promise<Ip | null>;
  create(ip: NewIp, tx?: Transaction): Promise<Ip>;
  update(id: string, ip: UpdateIp, tx?: Transaction): Promise<Ip>;
  delete(id: string, tx?: Transaction): Promise<void>;

  // Associations
  findByMediaId(mediaId: string, tx?: Transaction): Promise<Ip[]>;
  getMediaIps(
    mediaId: string,
    tx?: Transaction
  ): Promise<(Ip & { confidence: number | null; associationSource: string })[]>;
  addMedia(
    mediaId: string,
    ipId: string,
    confidence?: number,
    source?: string,
    tx?: Transaction
  ): Promise<void>;
  removeMedia(mediaId: string, ipId: string, tx?: Transaction): Promise<void>;
  addMediaBulk(
    mediaId: string,
    ipsData: { id: string; confidence?: number }[],
    source?: string,
    tx?: Transaction
  ): Promise<void>;
};

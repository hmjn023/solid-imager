import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const ipsQueryKeys = {
	all: () => ["allIps"] as const,
};

export const defaultIpsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildIpsQueryOptions(queryFn: () => Promise<Ip[]>) {
	return queryOptions({
		queryKey: ipsQueryKeys.all(),
		queryFn,
		...defaultIpsQueryConfig,
	});
}

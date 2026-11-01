import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const ipsQueryKeys = {
	all: () => ["allIps"] as const,
};

export const defaultIpsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildIpsQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<Ip[]>,
) {
	return {
		queryKey: ipsQueryKeys.all(),
		queryFn,
		...defaultIpsQueryConfig,
	};
}

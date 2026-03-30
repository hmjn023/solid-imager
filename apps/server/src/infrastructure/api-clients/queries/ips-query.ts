import { queryOptions } from "@tanstack/solid-query";
import { fetchAllIps } from "../ips-api";

export const allIpsQueryOptions = () =>
	queryOptions({
		queryKey: ["allIps"],
		queryFn: fetchAllIps,
	});

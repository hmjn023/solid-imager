import { queryOptions } from "@tanstack/solid-query";
import { orpc } from "../orpc-client";

export const configQueryOptions = () =>
	queryOptions({
		queryKey: ["config"],
		queryFn: () => orpc.config.get(),
	});

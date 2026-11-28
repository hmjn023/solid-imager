import { createFileRoute } from "@tanstack/solid-router";
import { isServer } from "@solidjs/web";
import { jobsQueryKeys } from "@solid-imager/ui/query";
import { ManagerPage } from "~/components/pages/manager-page";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/manager")({
	loader: async ({ context }: RouteLoaderContext) => {
		if (!isServer) return;
		await Promise.allSettled([
			context.queryClient.query(allProjectsQueryOptions()),
			context.queryClient.query(allIpsQueryOptions()),
			context.queryClient.query(allCharactersQueryOptions()),
			context.queryClient.query({
				queryKey: jobsQueryKeys.activeBatches(),
				queryFn: ({ signal }) => orpc.jobs.activeBatches({}, { signal }),
			}),
		]);
	},
	component: ManagerPage,
});

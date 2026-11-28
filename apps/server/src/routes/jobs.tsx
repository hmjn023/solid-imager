import { createFileRoute } from "@tanstack/solid-router";
import {
	buildInfiniteJobsQueryOptions,
	jobSelectionSearchSchema,
	jobTypesQueryOptions,
} from "@solid-imager/ui/jobs";
import { isServer } from "@solidjs/web";
import { JobsPage } from "~/components/pages/jobs-page";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/jobs")({
	validateSearch: jobSelectionSearchSchema,
	loader: async ({ context }: RouteLoaderContext) => {
		if (!isServer) return;
		await Promise.allSettled([
			context.queryClient.infiniteQuery(
				buildInfiniteJobsQueryOptions({}, (input, signal) =>
					orpc.jobs.list(input, { signal }),
				),
			),
			context.queryClient.query(jobTypesQueryOptions(orpc.jobs)),
		]);
	},
	component: JobsPage,
});

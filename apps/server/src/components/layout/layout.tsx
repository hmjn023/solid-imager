import { JobsBadgeContext } from "@solid-imager/ui/app-shell";
import { useJobsQueryEvents } from "@solid-imager/ui/jobs";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import {
	configQueryKeys,
	jobsQueryKeys,
	readQueryData,
} from "@solid-imager/ui/query";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Outlet } from "@tanstack/solid-router";
import { createEffect, createSignal, onSettled, untrack } from "solid-js";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { AppShell } from "./app-shell";

const JOBS_BADGE_STALE_MS = 15_000;

export function jobsBadgeQueryOptions(status: "active" | "failed") {
	return queryOptions({
		queryKey: [...jobsQueryKeys.all(), "badge", status],
		queryFn: ({ signal }) =>
			orpc.jobs.list({ status, limit: 1, offset: 0 }, { signal }),
		staleTime: JOBS_BADGE_STALE_MS,
		select: (response) => response.total,
	});
}

export function AppLayout(props: { jobsReplaySince?: number }) {
	const queryClient = useQueryClient();
	const workspace = useWorkspaceNavigation();
	const [context, setContext] = createSignal<WebMCP.ModelContext>();
	onSettled(() => {
		setContext(document.modelContext);
	});
	const jobsReplaySince = untrack(() => props.jobsReplaySince);
	const jobsReplay =
		jobsReplaySince === undefined
			? undefined
			: { replaySince: jobsReplaySince };
	useJobsQueryEvents((signal) => orpc.jobs.events(jobsReplay, { signal }));
	const activeJobsBadge = useQuery(() => jobsBadgeQueryOptions("active"));
	const failedJobsBadge = useQuery(() => jobsBadgeQueryOptions("failed"));
	const jobsCounts = () => ({
		active: readQueryData(activeJobsBadge) ?? 0,
		failed: readQueryData(failedJobsBadge) ?? 0,
	});
	const publication = useQuery(() => ({
		queryKey: [...configQueryKeys.all(), "webTools"],
		queryFn: ({ signal }) => orpc.config.webTools(undefined, { signal }),
		enabled: !!context(),
		refetchInterval: 30_000,
	}));
	createEffect(
		() => {
			const browser = context();
			return browser
				? { browser, published: readQueryData(publication) }
				: undefined;
		},
		(registrationContext) => {
			if (!registrationContext?.published) return;
			const { browser, published } = registrationContext;
			const registration = new AbortController();
			void import("~/infrastructure/mcp/web-tools")
				.then(({ registerWebTools }) =>
					registerWebTools(
						browser,
						published,
						queryClient,
						workspace,
						registration.signal,
					),
				)
				.catch((error: unknown) => {
					if (registration.signal.aborted) return;
					registration.abort();
					console.warn("Could not register Solid Imager WebMCP tools", error);
				});
			return () => registration.abort();
		},
	);
	return (
		<JobsBadgeContext value={jobsCounts}>
			<AppShell statusIndicator={<RouteTransitionIndicator />}>
				<ApiActivityIndicator />
				<Outlet />
			</AppShell>
		</JobsBadgeContext>
	);
}

import { JobsBadgeContext } from "@solid-imager/ui/app-shell";
import { useJobsQueryEvents } from "@solid-imager/ui/jobs";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { configQueryKeys, jobsQueryKeys } from "@solid-imager/ui/query";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Outlet } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import { ApiActivityIndicator } from "~/components/api-activity-indicator";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { AppShell } from "./app-shell";

const JOBS_BADGE_STALE_MS = 15_000;

export function AppLayout() {
	const queryClient = useQueryClient();
	const workspace = useWorkspaceNavigation();
	const [context, setContext] = createSignal<WebMCP.ModelContext>();
	onMount(() => setContext(document.modelContext));
	useJobsQueryEvents((signal) => orpc.jobs.events(undefined, { signal }));
	const activeJobsBadge = createQuery(() => ({
		queryKey: [...jobsQueryKeys.all(), "badge", "active"],
		queryFn: ({ signal }) =>
			orpc.jobs.list({ status: "active", limit: 1, offset: 0 }, { signal }),
		enabled: !isServer,
		staleTime: JOBS_BADGE_STALE_MS,
		select: (response) => response.total,
	}));
	const failedJobsBadge = createQuery(() => ({
		queryKey: [...jobsQueryKeys.all(), "badge", "failed"],
		queryFn: ({ signal }) =>
			orpc.jobs.list({ status: "failed", limit: 1, offset: 0 }, { signal }),
		enabled: !isServer,
		staleTime: JOBS_BADGE_STALE_MS,
		select: (response) => response.total,
	}));
	const jobsCounts = () => ({
		active: activeJobsBadge.data ?? 0,
		failed: failedJobsBadge.data ?? 0,
	});
	const publication = createQuery(() => ({
		queryKey: [...configQueryKeys.all(), "webTools"],
		queryFn: ({ signal }) => orpc.config.webTools(undefined, { signal }),
		enabled: !!context(),
		refetchInterval: 30_000,
	}));
	createEffect(() => {
		const browser = context();
		const published = publication.data;
		if (!browser || !published) return;
		const registration = new AbortController();
		onCleanup(() => registration.abort());
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
	});
	return (
		<JobsBadgeContext.Provider value={jobsCounts}>
			<AppShell statusIndicator={<RouteTransitionIndicator />}>
				<ApiActivityIndicator />
				<Outlet />
			</AppShell>
		</JobsBadgeContext.Provider>
	);
}

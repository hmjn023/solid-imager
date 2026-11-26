import { mediaSourceInfoSchema } from "@solid-imager/core/sources";
import { subscribeAllSourceEvents } from "~/hooks/use-media-source-events";
import { useSourcesPage } from "@solid-imager/ui/sources";
import { ApiActivityIndicator } from "@solid-imager/ui/api-activity-indicator";
import { AppShell } from "@solid-imager/ui/app-shell";
import { useJobsQueryEvents } from "@solid-imager/ui/jobs";
import { MediaContentAccessContext } from "@solid-imager/ui/media-actions";
import { jobsQueryKeys } from "@solid-imager/ui/query";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts";
import { Toaster } from "@solid-imager/ui/toast";
import { useLiveQuery } from "@tanstack/solid-db";
import {
	createQuery,
	type QueryClient,
	useQueryClient,
} from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	Outlet,
	useNavigate,
} from "@tanstack/solid-router";
import { getCollections, refetchCollection } from "~/collections";
import { collectionQueryKeys } from "~/collections/query-keys";
import { PendingDownloadsIndicator } from "~/components/imports/pending-downloads-indicator";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { getApiDocsUrl } from "~/infrastructure/settings/server-settings";
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";
import { getApiFetch } from "~/infrastructure/tauri-fetch-helpers";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

type AppRouterContext = { queryClient: QueryClient };

const JOBS_BADGE_STALE_MS = 15_000;

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function RootRouteComponent() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { sources } = getCollections();
	const sourceCollection = useLiveQuery(() => sources);
	useJobsQueryEvents((signal) => orpc.jobs.events(undefined, { signal }));
	const activeJobsBadge = createQuery(() => ({
		queryKey: [...jobsQueryKeys.all(), "badge", "active"],
		queryFn: ({ signal }) =>
			orpc.jobs.list({ status: "active", limit: 1, offset: 0 }, { signal }),
		staleTime: JOBS_BADGE_STALE_MS,
		select: (response) => response.total,
	}));
	const failedJobsBadge = createQuery(() => ({
		queryKey: [...jobsQueryKeys.all(), "badge", "failed"],
		queryFn: ({ signal }) =>
			orpc.jobs.list({ status: "failed", limit: 1, offset: 0 }, { signal }),
		staleTime: JOBS_BADGE_STALE_MS,
		select: (response) => response.total,
	}));
	const jobsCounts = () => ({
		active: activeJobsBadge.data ?? 0,
		failed: failedJobsBadge.data ?? 0,
	});
	const sourceData = () => {
		const cachedSources = sourceCollection();
		return cachedSources.length > 0 ||
			(sourceCollection.isReady && !sources.utils.isError)
			? cachedSources
			: [];
	};
	const sourcePage = useSourcesPage({
		actions: {
			createMediaSource: async (data: unknown) => {
				const result = await createMediaSource(
					mediaSourceInfoSchema.parse(data),
				);
				await refetchCollection(sources);
				return result;
			},
			updateMediaSource: async (id: string, data: unknown) => {
				const result = await updateMediaSource(
					id,
					mediaSourceInfoSchema.parse(data),
				);
				await refetchCollection(sources);
				return result;
			},
			deleteMediaSource: async (id: string) => {
				const result = await deleteMediaSource(id);
				await refetchCollection(sources);
				return result;
			},
			syncMediaSources: async (ids: string[]) => {
				const result = await syncMediaSources(ids);
				await refetchCollection(sources);
				return result;
			},
		},
		queryClient,
		invalidateQueryKey: collectionQueryKeys.sources(),
		registerEvents: subscribeAllSourceEvents,
		getSourceIds: () =>
			sourceData()
				.map((source) => source.id ?? source.name)
				.filter((id): id is string => Boolean(id)),
	});

	return (
		<ShortcutPreferencesProvider>
			<Toaster />
			<AppShell
				apiDocsHref={getApiDocsUrl()}
				jobsCounts={jobsCounts}
				mediaSources={sourceData}
				onNavigate={(to) => void navigate({ to })}
				renderPendingDownloadsIndicator={(compact) => (
					<PendingDownloadsIndicator compact={compact()} />
				)}
				sourcePage={sourcePage}
				statusIndicator={<RouteTransitionIndicator />}
				serverConnectionsHref="/servers"
			>
				<ApiActivityIndicator />
				<MediaContentAccessContext.Provider
					value={{
						getUrl: buildMediaContentUrl,
						fetchContent: (url) => getApiFetch()(url),
					}}
				>
					<Outlet />
				</MediaContentAccessContext.Provider>
			</AppShell>
		</ShortcutPreferencesProvider>
	);
}

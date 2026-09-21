import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { RouteTransitionIndicator } from "@solid-imager/ui/router-status";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts/index";
import { Toaster } from "@solid-imager/ui/toast";
import { useLiveQuery } from "@tanstack/solid-db";
import { useQueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	Outlet,
	useNavigate,
} from "@tanstack/solid-router";
import { getCollections } from "~/collections";
import { collectionQueryKeys } from "~/collections/query-keys";
import { PendingDownloadsIndicator } from "~/components/imports/pending-downloads-indicator";
import { getApiBaseUrl } from "~/infrastructure/api-base";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import type { AppRouterContext } from "~/router";

export const Route = createRootRouteWithContext<AppRouterContext>()({
	component: RootRouteComponent,
});

function registerSourceEvents(
	handler: import("@solid-imager/ui/hooks/use-sources-events").RawEventHandler,
): () => void {
	return subscribeToEventStream(
		(signal) => orpc.sources.events({ id: "*" }, { signal }),
		handler,
	);
}

function RootRouteComponent() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { sources } = getCollections();
	const sourceCollection = useLiveQuery(() => sources);
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
				await sources.utils.refetch();
				return result;
			},
			updateMediaSource: async (id: string, data: unknown) => {
				const result = await updateMediaSource(
					id,
					mediaSourceInfoSchema.parse(data),
				);
				await sources.utils.refetch();
				return result;
			},
			deleteMediaSource: async (id: string) => {
				const result = await deleteMediaSource(id);
				await sources.utils.refetch();
				return result;
			},
			syncMediaSources: async (ids: string[]) => {
				const result = await syncMediaSources(ids);
				await sources.utils.refetch();
				return result;
			},
		},
		queryClient,
		invalidateQueryKey: collectionQueryKeys.sources(),
		registerEvents: registerSourceEvents,
		getSourceIds: () =>
			sourceData()
				.map((source) => source.id ?? source.name)
				.filter((id): id is string => Boolean(id)),
	});

	return (
		<ShortcutPreferencesProvider>
			<Toaster />
			<AppShell
				apiDocsHref={`${getApiBaseUrl()}/docs/swagger`}
				mediaSources={sourceData}
				onNavigate={(to) => void navigate({ to })}
				renderPendingDownloadsIndicator={(compact) => (
					<PendingDownloadsIndicator compact={compact} />
				)}
				sourcePage={sourcePage}
				statusIndicator={<RouteTransitionIndicator />}
				serverConnectionsHref="/servers"
			>
				<Outlet />
			</AppShell>
		</ShortcutPreferencesProvider>
	);
}

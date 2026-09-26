import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { AppShell as SharedAppShell } from "@solid-imager/ui/layouts/app-shell";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import type { ParentProps } from "solid-js";
import { PendingDownloadsIndicator } from "~/components/imports/pending-downloads-indicator";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

type AppShellProps = ParentProps<{
	statusIndicator?: import("solid-js").JSX.Element;
}>;

/** Server adapter for the shared workspace shell. */
export function AppShell(props: AppShellProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceEventTransport = createServerTransport(() => "*", {
		onResumeFromIdle: () => {
			void queryClient.refetchQueries({
				queryKey: mediaSourcesQueryOptions().queryKey,
			});
		},
	});
	const sourcePage = useSourcesPage({
		actions: {
			createMediaSource: (data: unknown) =>
				createMediaSource(mediaSourceInfoSchema.parse(data)),
			updateMediaSource: (id: string, data: unknown) =>
				updateMediaSource(id, mediaSourceInfoSchema.parse(data)),
			deleteMediaSource,
			syncMediaSources,
		},
		queryClient,
		invalidateQueryKey: mediaSourcesQueryOptions().queryKey,
		registerEvents: (handler) => sourceEventTransport.listen(handler),
		getSourceIds: () =>
			(mediaSources.data ?? []).flatMap((source) =>
				source.id ? [source.id] : [],
			),
	});

	return (
		<SharedAppShell
			apiDocsHref="/docs/scalar"
			mediaSources={() => mediaSources.data ?? []}
			onNavigate={(to) => void navigate({ to })}
			renderPendingDownloadsIndicator={(compact) => (
				<PendingDownloadsIndicator compact={compact} />
			)}
			sourcePage={sourcePage}
			statusIndicator={props.statusIndicator}
		>
			{props.children}
		</SharedAppShell>
	);
}

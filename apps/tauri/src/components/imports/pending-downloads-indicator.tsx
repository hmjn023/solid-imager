import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/pending-downloads-indicator";
import { getApiBaseUrl } from "~/infrastructure/api-base";
import {
	cancelPendingImports,
	listPendingImports,
	processPendingImports,
	subscribeImportEvents,
} from "~/infrastructure/api-clients/imports-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

export function PendingDownloadsIndicator(props: { compact?: boolean }) {
	return (
		<SharedPendingDownloadsIndicator
			cancelPending={cancelPendingImports}
			compact={props.compact}
			countPending={async () => {
				const result = await orpc.imports.countPending();
				return result.count;
			}}
			danbooruPreview={{
				apiBase: getApiBaseUrl,
				loadPost: (id) => orpc.danbooru.getPost({ id }),
			}}
			listPending={listPendingImports}
			listSources={fetchMediaSources}
			pixivPreview={{
				apiBase: getApiBaseUrl,
				loadPoster: async (id) =>
					(await orpc.viewer.pixivArtwork({ id })).pages[0]?.preview,
			}}
			processPending={(jobIds, targetSourceId) =>
				processPendingImports(jobIds, targetSourceId)
			}
			subscribeImportEvents={subscribeImportEvents}
		/>
	);
}

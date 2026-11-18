import { t } from "@solid-imager/i18n";
import type { DownloadItem } from "@solid-imager/core/media";
import { createSignal } from "solid-js";
import { toast } from "../toast";

/** Keep the state of an import with its URL as the viewer moves between posts and pages. */
export function createViewerImports(
	enqueue: (items: DownloadItem[]) => Promise<unknown>,
) {
	type ImportState = "pending" | "queued";
	const [targets, setTargets] = createSignal(new Map<string, ImportState>());
	async function add(items: DownloadItem[]) {
		const batch = new Map<string, DownloadItem>();
		for (const item of items) {
			if (item.targetUrl && !targets().has(item.targetUrl)) {
				batch.set(item.targetUrl, item);
			}
		}
		if (!batch.size) return;

		function markBatch(state: ImportState | undefined) {
			setTargets((current) => {
				const next = new Map(current);
				for (const url of batch.keys()) {
					if (state) next.set(url, state);
					else next.delete(url);
				}
				return next;
			});
		}
		markBatch("pending");
		try {
			await enqueue([...batch.values()]);
			markBatch("queued");
			toast.success(t("detail.addedToImportInbox"), {
				description: t("detail.chooseADestinationFromTheSidebarImportInboxTo"),
			});
		} catch (error) {
			markBatch(undefined);
			toast.error(t("detail.couldNotAddToImportInbox"), {
				description:
					error instanceof Error ? error.message : t("detail.pleaseRetry"),
			});
		}
	}
	return {
		state: (url?: string) => (url ? targets().get(url) : undefined),
		add,
	};
}

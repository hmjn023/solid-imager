import { t } from "@solid-imager/i18n";
import type { AppContractClient } from "@solid-imager/core/contract";
import type { DownloadItem } from "@solid-imager/core/media";
import { createSignal } from "solid-js";
import { toast } from "../toast";

type QueuedImports = Pick<
	Awaited<ReturnType<AppContractClient["imports"]["bulkAdd"]>>,
	"createdRequests"
>;

/** Keep the state of an import with its URL as the viewer moves between posts and pages. */
export function createViewerImports(
	enqueue: (items: DownloadItem[]) => Promise<QueuedImports | void>,
) {
	type ImportTarget =
		| { state: "pending" }
		| { state: "queued"; requestId?: string };
	const [targets, setTargets] = createSignal(new Map<string, ImportTarget>());
	let additionsInFlight = 0;
	// A different tab can cancel a committed request before its enqueue response arrives.
	const recentlyCancelled = new Set<string>();

	async function add(items: DownloadItem[]) {
		const batch = new Map<string, DownloadItem>();
		for (const item of items) {
			if (item.targetUrl && !targets().has(item.targetUrl)) {
				batch.set(item.targetUrl, item);
			}
		}
		if (!batch.size) return;

		function setBatchTargets(
			targetFor: (url: string) => ImportTarget | undefined,
		) {
			setTargets((current) => {
				const next = new Map(current);
				for (const url of batch.keys()) {
					const target = targetFor(url);
					if (target) next.set(url, target);
					else next.delete(url);
				}
				return next;
			});
		}
		additionsInFlight++;
		setBatchTargets(() => ({ state: "pending" }));
		try {
			const result = await enqueue([...batch.values()]);
			const requestIds =
				result?.createdRequests &&
				new Map(
					result.createdRequests.map((request) => [
						request.targetUrl,
						request.id,
					]),
				);
			let didQueue = false;
			setBatchTargets((url) => {
				const requestId = requestIds?.get(url);
				if (requestIds && (!requestId || recentlyCancelled.has(requestId)))
					return;
				didQueue = true;
				return { state: "queued", requestId };
			});
			if (didQueue) {
				toast.success(t("detail.addedToImportInbox"), {
					description: t(
						"detail.chooseADestinationFromTheSidebarImportInboxTo",
					),
				});
			}
		} catch (error) {
			setBatchTargets(() => undefined);
			toast.error(t("detail.couldNotAddToImportInbox"), {
				description:
					error instanceof Error ? error.message : t("detail.pleaseRetry"),
			});
		} finally {
			additionsInFlight--;
			if (!additionsInFlight) recentlyCancelled.clear();
		}
	}
	function clearCancelled(jobIds: string[]) {
		const cancelled = new Set(jobIds);
		if (additionsInFlight)
			for (const id of cancelled) recentlyCancelled.add(id);
		setTargets((current) => {
			const next = new Map(current);
			for (const [url, target] of current) {
				if (
					target.state === "queued" &&
					target.requestId &&
					cancelled.has(target.requestId)
				)
					next.delete(url);
			}
			return next.size === current.size ? current : next;
		});
	}
	return {
		state: (url?: string) => (url ? targets().get(url)?.state : undefined),
		add,
		clearCancelled,
	};
}

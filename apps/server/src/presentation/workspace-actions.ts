import type { QueryClient } from "@tanstack/solid-query";
import { clearMediaReturnPath } from "@solid-imager/ui/media-context";
import {
	mediaDetailsQueryKeys,
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "@solid-imager/ui/query-options";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries";
import type {
	WorkspaceNavigation,
	WorkspaceTarget,
} from "~/presentation/workspace-navigation";
import {
	readWorkspaceView,
	waitForWorkspaceView,
	type WorkspaceView,
} from "~/presentation/workspace-view";

export class ViewActionError extends Error {
	constructor(
		message: string,
		readonly code: string,
	) {
		super(message);
	}
}

type MediaTarget = Extract<WorkspaceTarget, { kind: "media" }>;
type ViewTarget =
	| Exclude<WorkspaceTarget, { kind: "search" }>
	| { kind: "search"; snapshotId: string; searchKey: string };

function matchesTarget(target: ViewTarget, view: WorkspaceView) {
	switch (target.kind) {
		case "media":
			return (
				view.kind === "media" &&
				view.media.id === target.mediaId &&
				view.media.mediaSourceId === target.sourceId
			);
		case "search": {
			if (
				view.kind !== "search" ||
				view.snapshotId !== target.snapshotId ||
				view.searchKey !== target.searchKey ||
				!view.ready ||
				view.state.fetchState === "background-fetching"
			)
				return false;
			if (
				view.state.phase === "error" ||
				view.state.phase === "offline" ||
				view.state.error
			) {
				throw new ViewActionError(
					"Search could not load. Check the connection and retry.",
					"SEARCH_FAILED",
				);
			}
			return (
				view.resultsCurrent &&
				(view.state.phase === "data" || view.state.phase === "empty")
			);
		}
	}
}

// Keep the acknowledged write and its result even if the user leaves or the view fails to refresh.
export async function afterCommit<T extends object>(
	result: T,
	present: () => Promise<void>,
) {
	try {
		await present();
		return result;
	} catch {
		return { ...result, presentation: "unconfirmed" as const };
	}
}

export function createViewActions(
	navigation: WorkspaceNavigation,
	queryClient: QueryClient,
) {
	function beforeNavigation(signal: AbortSignal, origin = navigation.href()) {
		signal.throwIfAborted();
		if (navigation.href() !== origin)
			throw new ViewActionError("The user changed views.", "VIEW_CHANGED");
		if (
			document.querySelector('[role="dialog"], [role="alertdialog"]') ||
			navigation.pathname().replace(/\/$/, "") === "/config"
		) {
			throw new ViewActionError(
				"Finish editing or close the dialog before changing the view.",
				"VIEW_BUSY",
			);
		}
		return origin;
	}
	function confirm(
		target: ViewTarget,
		signal: AbortSignal,
		ready?: (view: WorkspaceView) => boolean,
	) {
		return waitForWorkspaceView(
			(view) => matchesTarget(target, view) && (!ready || ready(view)),
			signal,
			() => {
				if (!navigation.at(target))
					throw new ViewActionError("The user changed views.", "VIEW_CHANGED");
			},
		);
	}
	async function show(
		target: ViewTarget,
		signal: AbortSignal,
		origin = navigation.href(),
	) {
		beforeNavigation(signal, origin);
		if (target.kind === "media") {
			const { sourceId, mediaId } = target;
			await queryClient.query({
				...mediaDetailsQueryOptions(sourceId, mediaId),
				staleTime: 0,
				queryFn: () => orpc.media.getDetails({ sourceId, mediaId }, { signal }),
			});
			beforeNavigation(signal, origin);
		}
		if (!navigation.at(target)) {
			const view = readWorkspaceView();
			if (
				target.kind === "media" &&
				view?.kind !== "media" &&
				view?.kind !== "search"
			)
				clearMediaReturnPath();
			await navigation.open(
				target,
				target.kind === "media" && view?.kind === "search"
					? view.media
					: undefined,
			);
		}
		await confirm(target, signal);
	}
	async function reflectTags(
		target: MediaTarget,
		action: "add" | "remove",
		tagIds: string[],
		signal: AbortSignal,
	) {
		const detailKey = mediaDetailsQueryKeys.detail(
			target.sourceId,
			target.mediaId,
		);
		await Promise.all(
			[
				detailKey,
				sourceMediaQueryKeys.forSource(target.sourceId),
				searchQueryKeys.all(),
			].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
		);
		await confirm(
			target,
			signal,
			(view) =>
				view.kind === "media" &&
				tagIds.every((id) =>
					action === "add"
						? view.media.tags.some(
								(tag) => tag.id === id && tag.type === "positive",
							)
						: !view.media.tags.some((tag) => tag.id === id),
				),
		);
	}
	return { beforeNavigation, show, reflectTags };
}

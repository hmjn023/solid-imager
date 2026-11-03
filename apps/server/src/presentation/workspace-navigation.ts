import {
	saveMediaContext,
	type MediaContextItem,
} from "@solid-imager/ui/media-context";
import { useLocation, useRouter } from "@tanstack/solid-router";

export type WorkspaceTarget =
	| { kind: "media"; sourceId: string; mediaId: string }
	| { kind: "search"; snapshotId: string }
	| { kind: "job"; jobId: string };

function destination(target: WorkspaceTarget) {
	switch (target.kind) {
		case "media":
			return {
				to: "/sources/$mediaSourceId/$mediaId",
				params: { mediaSourceId: target.sourceId, mediaId: target.mediaId },
			} as const;
		case "job":
			return { to: "/jobs", search: { jobId: target.jobId } } as const;
		case "search":
			return { to: "/search", search: { search: target.snapshotId } } as const;
	}
}

// Human navigation and assisted navigation use the same route and return history.
export type WorkspaceNavigation = {
	href: () => string;
	selectedJobId: () => string | undefined;
	pathname: () => string;
	open: (
		target: WorkspaceTarget,
		items?: readonly MediaContextItem[],
	) => Promise<void>;
	at: (target: WorkspaceTarget) => boolean;
	prepareMediaDetail: (
		media: MediaContextItem,
		items?: readonly MediaContextItem[],
	) => void;
	openMediaDetail: (
		media: MediaContextItem,
		items?: readonly MediaContextItem[],
	) => void;
};
export function useWorkspaceNavigation(): WorkspaceNavigation {
	const router = useRouter();
	const location = useLocation();
	const remember = (items: readonly MediaContextItem[]) =>
		saveMediaContext(location().href, items);
	function open(target: WorkspaceTarget, items?: readonly MediaContextItem[]) {
		if (items) remember(items);
		return router.navigate(destination(target));
	}
	return {
		href: () => location().href,
		selectedJobId: () => location().search.jobId,
		pathname: () => location().pathname,
		open,
		at(target: WorkspaceTarget) {
			const current = location();
			const route = router.buildLocation(destination(target));
			return (
				current.pathname.replace(/\/$/, "") ===
					route.pathname.replace(/\/$/, "") &&
				(target.kind !== "job" || current.search.jobId === target.jobId) &&
				(target.kind !== "search" ||
					current.search.search === target.snapshotId)
			);
		},
		prepareMediaDetail: (
			media: MediaContextItem,
			items?: readonly MediaContextItem[],
		) => {
			remember(items ?? [media]);
		},
		openMediaDetail: (
			media: MediaContextItem,
			items?: readonly MediaContextItem[],
		) => {
			void open(
				{ kind: "media", sourceId: media.mediaSourceId, mediaId: media.id },
				items ?? [media],
			);
		},
	};
}

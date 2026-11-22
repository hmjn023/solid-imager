import { t } from "@solid-imager/i18n";
import type { ViewerFetch, PixivClientFactory } from "./pixiv-account";
import type { AppContractClient } from "@solid-imager/core/contract";
import { onCleanup, onMount } from "solid-js";
import {
	type RouterHistory,
	Outlet,
	useLocation,
	useNavigate,
} from "@tanstack/solid-router";
import { DanbooruScreen } from "../screens/danbooru-screen";
import { PixivScreen } from "../screens/pixiv-screen";
import type { ImportEventHandler } from "../pending-downloads-indicator.types";
import { createViewerImports } from "./viewer-imports";

export {
	initialViewerSearchOptions,
	pixivQueryScope,
	viewerPostQueryOptions,
} from "./query-options";

export function parseViewerPostId(value?: string) {
	const id = value && /^\d+$/.test(value) ? Number(value) : 0;
	return id > 0 && Number.isSafeInteger(id) ? id : undefined;
}

export function ExternalViewerRoute(
	props: {
		client: Pick<AppContractClient, "viewer" | "danbooru" | "imports">;
		apiBase: () => string;
		history: Pick<RouterHistory, "go" | "createHref">;
		subscribeImportEvents: (handler: ImportEventHandler) => () => void;
	} & (
		| { provider: "danbooru" }
		| {
				provider: "pixiv";
				createViewer: PixivClientFactory;
				openPixivLogin?: () => Promise<void>;
				fetch?: ViewerFetch;
		  }
	),
) {
	const navigate = useNavigate(),
		location = useLocation();
	const imports = createViewerImports((items) =>
		props.client.imports.bulkAdd({ items }),
	);
	onMount(() => {
		onCleanup(
			props.subscribeImportEvents((event) => {
				if (event.event === "import-request:deleted")
					imports.clearCancelled(event.data.jobIds);
			}),
		);
	});
	const collectionDepth = () => {
		const { state } = location();
		if (
			"externalViewerCollectionDepth" in state &&
			typeof state.externalViewerCollectionDepth === "number" &&
			Number.isSafeInteger(state.externalViewerCollectionDepth) &&
			state.externalViewerCollectionDepth > 0
		)
			return state.externalViewerCollectionDepth;
	};
	const selectedPostId = () => {
		const path = location().pathname.split("/");
		return path[1] === props.provider ? parseViewerPostId(path[2]) : undefined;
	};
	const navigation = {
		get selectedPostId() {
			return selectedPostId();
		},
		postHref: (id: number) =>
			props.history.createHref("/" + props.provider + "/" + id),
		onOpenPost: (id: number, replace?: boolean) => {
			const depth = selectedPostId() ? collectionDepth() : 0;
			const nextDepth =
				depth === undefined ? undefined : depth + (replace ? 0 : 1);
			void navigate({
				to: props.provider === "pixiv" ? "/pixiv/$postId" : "/danbooru/$postId",
				params: { postId: String(id) },
				replace,
				state: (state: RouterHistory["location"]["state"]) => ({
					...state,
					externalViewerCollectionDepth: nextDepth,
				}),
			});
		},
		onClosePost: () => {
			const depth = collectionDepth();
			if (depth) props.history.go(-depth);
			else
				void navigate({
					to: props.provider === "pixiv" ? "/pixiv" : "/danbooru",
					replace: true,
				});
		},
	};
	return (
		<>
			{props.provider === "danbooru" ? (
				<DanbooruScreen
					apiBase={props.apiBase}
					{...navigation}
					search={async (input) => {
						const result = await props.client.viewer.search({
							...input,
							provider: "danbooru",
						});
						if (result.provider !== "danbooru")
							throw new Error(t("pixivScreen.searchDestinationDoesNotMatch"));
						return result;
					}}
					getPost={(id) => props.client.danbooru.getPost({ id })}
					suggestTags={(query) => props.client.viewer.suggestTags({ query })}
					imports={imports}
				/>
			) : (
				<PixivScreen
					{...navigation}
					client={props.client}
					imports={imports}
					apiBase={props.apiBase}
					createViewer={props.createViewer}
					openPixivLogin={props.openPixivLogin}
					fetch={props.fetch}
				/>
			)}
			<Outlet />
		</>
	);
}

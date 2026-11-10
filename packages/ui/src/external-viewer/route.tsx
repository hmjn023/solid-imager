import type { ViewerFetch, PixivClientFactory } from "./pixiv-account";
import type { AppContractClient } from "@solid-imager/core/contract";
import {
	type RouterHistory,
	Outlet,
	useLocation,
	useNavigate,
} from "@tanstack/solid-router";
import { DanbooruScreen } from "../screens/danbooru-screen";
import { PixivScreen } from "../screens/pixiv-screen";

export function ExternalViewerRoute(
	props: {
		client: Pick<AppContractClient, "viewer" | "danbooru" | "imports">;
		apiBase: () => string;
		history: Pick<RouterHistory, "back" | "createHref">;
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
	let openedFromCollection = false;
	const selectedPostId = () => {
		const path = location().pathname.split("/");
		const id =
			path[1] === props.provider && /^\d+$/.test(path[2] ?? "")
				? Number(path[2])
				: 0;
		return id > 0 && Number.isSafeInteger(id) ? id : undefined;
	};
	const navigation = {
		get selectedPostId() {
			return selectedPostId();
		},
		postHref: (id: number) =>
			props.history.createHref("/" + props.provider + "/" + id),
		onOpenPost: (id: number, replace?: boolean) => {
			if (!selectedPostId()) openedFromCollection = true;
			void navigate({
				to: props.provider === "pixiv" ? "/pixiv/$postId" : "/danbooru/$postId",
				params: { postId: String(id) },
				replace,
			});
		},
		onClosePost: () => {
			if (openedFromCollection) {
				openedFromCollection = false;
				props.history.back();
			} else
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
					{...navigation}
					search={async (input) => {
						const result = await props.client.viewer.search({
							...input,
							provider: "danbooru",
						});
						if (result.provider !== "danbooru")
							throw new Error("検索先が一致しません");
						return result;
					}}
					getPost={(id) => props.client.danbooru.getPost({ id })}
					suggestTags={(query) => props.client.viewer.suggestTags({ query })}
					enqueueImport={(item) =>
						props.client.imports.bulkAdd({ items: [item] })
					}
				/>
			) : (
				<PixivScreen
					{...navigation}
					client={props.client}
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

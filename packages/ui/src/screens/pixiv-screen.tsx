import type { AppContractClient } from "@solid-imager/core/contract";
import type { PixivSearchResult } from "@solid-imager/core/external-viewer";
import { createQuery } from "@tanstack/solid-query";
import { For } from "solid-js";
import { createViewerImports } from "../external-viewer/detail";
import {
	createPixivAccount,
	type ViewerFetch,
	type PixivClientFactory,
	PixivAccountDialog,
} from "../external-viewer/pixiv-account";
import { PixivArtworkDetail } from "../external-viewer/pixiv-artwork-detail";
import { pixivImageHref } from "../external-viewer/post-media";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import {
	ViewerWorkspace,
	type ViewerNavigation,
} from "../external-viewer/workspace";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";

type PixivProps = ViewerNavigation & {
	client: Pick<AppContractClient, "viewer" | "imports">;
	apiBase: () => string;
	fetch?: ViewerFetch;
	createViewer: PixivClientFactory;
};

function PixivSearchInfo(props: {
	data: PixivSearchResult;
	onChoose: (tag: string, value: string) => void;
}) {
	return (
		<div class="mb-3 space-y-2">
			<p class="text-muted-foreground text-sm" aria-live="polite">
				{props.data.word
					? "pixiv 検索語 · " + props.data.word
					: "デイリーランキング"}
			</p>
			<For each={props.data.mappings.filter((row) => row.names.length > 1)}>
				{(row) => (
					<div class="flex min-w-0 items-center gap-2">
						<span class="truncate text-sm">{row.tag}</span>
						<Select
							options={row.names}
							value={row.selected}
							onChange={(value) => {
								if (value) props.onChoose(row.tag, value);
							}}
							itemComponent={(item) => (
								<SelectItem item={item.item}>{item.item.rawValue}</SelectItem>
							)}
						>
							<SelectTrigger aria-label={row.tag + " の pixiv タグ"}>
								<SelectValue<string>>
									{(state) => state.selectedOption()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
				)}
			</For>
		</div>
	);
}
export function PixivScreen(props: PixivProps) {
	const account = createPixivAccount(
		props.apiBase(),
		props.createViewer,
		props.fetch,
	);
	const browse = createViewerSearch<PixivSearchResult>(
		"pixiv",
		async (input, choices) => {
			const result = await account.transport().viewer.search({
				...input,
				provider: "pixiv",
				choices,
			});
			if (result.provider !== "pixiv") throw new Error("検索先が一致しません");
			return result;
		},
		account,
	);
	const imports = createViewerImports((item) =>
		props.client.imports.bulkAdd({ items: [item] }),
	);
	const detail = createQuery(() => ({
		queryKey: ["pixiv", "artwork", props.selectedPostId, ...account.scope()],
		queryFn: () =>
			account
				.transport()
				.viewer.pixivArtwork({ id: props.selectedPostId ?? 0 }),
		enabled: account.ready() && !!props.selectedPostId,
		gcTime: 0,
		retry: false,
		staleTime: 30_000,
	}));
	return (
		<ViewerWorkspace
			{...props}
			providerName="pixiv"
			siteUrl="https://www.pixiv.net"
			browse={browse}
			suggestTags={(query) => props.client.viewer.suggestTags({ query })}
			errorTitle="pixiv を検索できませんでした"
			emptyTitle="該当する作品がありません"
			actions={<PixivAccountDialog account={account} />}
			renderSearchInfo={(data) => (
				<PixivSearchInfo data={data} onChoose={browse.choose} />
			)}
			describePost={(post) => ({
				title: post.title || `pixiv #${post.id}`,
				thumbnail:
					post.thumbnail && pixivImageHref(props.apiBase(), post.thumbnail),
				info: [post.author, post.pageCount + "枚"].filter(Boolean).join(" · "),
			})}
			renderDetail={(navigation) => (
				<PixivArtworkDetail
					{...navigation}
					query={detail}
					imports={imports}
					apiBase={props.apiBase}
					animation={(id) => account.transport().animation(id)}
				/>
			)}
		/>
	);
}

import type { SearchState } from "@solid-imager/core/domain/search/schema";
import { createEffect, createSignal, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

export function EmbeddingSearchControls(props: {
	state: SearchState;
	setState: SetStoreFunction<SearchState>;
	onSearch: () => void;
	id: string;
}) {
	const [draft, setDraft] = createSignal(props.state.semanticQuery);
	createEffect(() => setDraft(props.state.semanticQuery));
	return (
		<div class="mb-4 space-y-3">
			<Show when={props.state.similarityAnchorMediaId}>
				<div class="space-y-2">
					<Label for={`${props.id}-model`}>類似検索モデル</Label>
					<Select
						options={["ccip", "embeddinggemma2"]}
						value={props.state.similarityModel}
						onChange={(value) => {
							props.setState(
								"similarityModel",
								value === "embeddinggemma2" ? "embeddinggemma2" : "ccip",
							);
						}}
						itemComponent={(item) => (
							<SelectItem item={item.item}>
								{item.item.rawValue === "ccip"
									? "CCIP（キャラクター）"
									: "EmbeddingGemma 2（画像全体）"}
							</SelectItem>
						)}
					>
						<SelectTrigger id={`${props.id}-model`} aria-label="類似検索モデル">
							<SelectValue<string>>
								{(state) =>
									state.selectedOption() === "ccip"
										? "CCIP（キャラクター）"
										: "EmbeddingGemma 2（画像全体）"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
			</Show>
			<form
				class="space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (!draft().trim()) return;
					props.setState({
						semanticQuery: draft().trim(),
						similarityAnchorMediaId: null,
						similarityModel: "embeddinggemma2",
						offset: 0,
						scrollY: 0,
					});
					props.onSearch();
				}}
			>
				<Label for={`${props.id}-text`}>自然言語検索（EmbeddingGemma 2）</Label>
				<Input
					id={`${props.id}-text`}
					name="semantic-query"
					maxLength={2000}
					placeholder="例: 夕焼けの海辺に立つ赤い服の人物"
					value={draft()}
					onInput={(event) => setDraft(event.currentTarget.value)}
				/>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" size="sm" disabled={!draft().trim()}>
						文章で画像を検索
					</Button>
					<Show when={props.state.semanticQuery}>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								props.setState("semanticQuery", "");
								setDraft("");
								props.onSearch();
							}}
						>
							文章検索を解除
						</Button>
					</Show>
				</div>
			</form>
			<Show when={props.state.semanticQuery}>
				<p class="text-xs text-muted-foreground">
					検索文: {props.state.semanticQuery}
				</p>
			</Show>
			<p class="text-xs text-muted-foreground">
				画像索引は Manager → Vector extraction
				で作成できます。類似検索・文章検索にはソースと件数を適用します。CCIP
				はキャラクターの類似性を検索します。
			</p>
		</div>
	);
}

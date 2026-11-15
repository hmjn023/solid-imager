import { t } from "@solid-imager/i18n";
import type { SearchState } from "@solid-imager/core/search";
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
					<Label for={`${props.id}-model`}>
						{t("embeddingSearchControls.similaritySearchModel")}
					</Label>
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
									? t("embeddingSearchControls.cCIPCharacters")
									: t("embeddingSearchControls.embeddingGemma2Visual")}
							</SelectItem>
						)}
					>
						<SelectTrigger
							id={`${props.id}-model`}
							aria-label={t("embeddingSearchControls.similaritySearchModel")}
						>
							<SelectValue<string>>
								{(state) =>
									state.selectedOption() === "ccip"
										? t("embeddingSearchControls.cCIPCharacters")
										: t("embeddingSearchControls.embeddingGemma2Visual")
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
				<Label for={`${props.id}-text`}>
					{t("embeddingSearchControls.naturalLanguageSearchEmbeddingGemma2")}
				</Label>
				<Input
					id={`${props.id}-text`}
					name="semantic-query"
					maxLength={2000}
					placeholder={t(
						"embeddingSearchControls.exampleAPersonInRedStandingOnABeach",
					)}
					value={draft()}
					onInput={(event) => setDraft(event.currentTarget.value)}
				/>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" size="sm" disabled={!draft().trim()}>
						{t("embeddingSearchControls.searchImagesAndVideoWithText")}
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
							{t("embeddingSearchControls.clearTextSearch")}
						</Button>
					</Show>
				</div>
			</form>
			<Show when={props.state.semanticQuery}>
				<p class="text-xs text-muted-foreground">
					{t("sortControls.searchTextValue", {
						value0: String(props.state.semanticQuery),
					})}
				</p>
			</Show>
			<p class="text-xs text-muted-foreground">
				{t(
					"embeddingSearchControls.buildIndexesForImagesAndRepresentativeVideoThumbnailsIn",
				)}
			</p>
		</div>
	);
}

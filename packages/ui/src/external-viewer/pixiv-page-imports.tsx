import {
	pixivDownloadItem,
	type PixivArtwork,
} from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import ChevronDown from "@lucide/solid/icons/chevron-down";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxDescription,
	CheckboxLabel,
} from "../checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../collapsible";
import type { ViewerDetailProps } from "./detail";
import { pixivImageHref } from "./post-media";

export function PixivPageImports(props: {
	artwork: PixivArtwork;
	apiBase: string;
	imports: ViewerDetailProps<PixivArtwork>["imports"];
}) {
	const [selected, setSelected] = createSignal(new Set<number>());
	const available = createMemo(() =>
		props.artwork.pages.flatMap((page, index) =>
			page.original && !props.imports.state(page.original) ? [index] : [],
		),
	);
	const selectedPages = createMemo(() =>
		available().filter((index) => selected().has(index)),
	);
	const missing = () =>
		props.artwork.pages.filter((page) => !page.original).length;

	function toggle(index: number, checked: boolean) {
		setSelected((current) => {
			const next = new Set(current);
			if (checked) next.add(index);
			else next.delete(index);
			return next;
		});
	}

	function add(indices: number[]) {
		const items = indices.map((index) =>
			pixivDownloadItem(props.artwork, index),
		);
		void props.imports.add(items.filter((item) => item !== null));
	}

	return (
		<Collapsible class="space-y-2">
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					disabled={!available().length}
					onClick={() => add(available())}
				>
					{t("pixivArtworkDetail.addAllPages")}
				</Button>
				<CollapsibleTrigger as={Button} variant="outline" class="group">
					{t("pixivArtworkDetail.choosePages")}
					<ChevronDown
						aria-hidden="true"
						class="group-data-[open]:rotate-180"
					/>
				</CollapsibleTrigger>
			</div>
			<Show when={missing() > 0}>
				<p class="text-xs text-muted-foreground">
					{t("pixivArtworkDetail.pagesWithoutOriginals", { count: missing() })}
				</p>
			</Show>
			<CollapsibleContent>
				<form
					class="space-y-2"
					onSubmit={(event) => {
						event.preventDefault();
						add(selectedPages());
					}}
				>
					<fieldset class="grid min-w-0 grid-cols-2 gap-2">
						<legend class="sr-only">
							{t("pixivArtworkDetail.choosePages")}
						</legend>
						<For each={props.artwork.pages}>
							{(page, index) => {
								const state = () =>
									props.imports.state(page.original ?? undefined);
								const status = () => {
									if (!page.original) return t("pixivArtworkDetail.noOriginal");
									if (state() === "pending") return t("detail.adding");
									if (state() === "queued")
										return t("detail.alreadyInImportInbox");
								};
								return (
									<Checkbox
										checked={selected().has(index()) || !!state()}
										disabled={!page.original || !!state()}
										onChange={(checked) => toggle(index(), checked)}
										class="relative min-w-0 rounded-md border border-border data-[checked]:border-primary focus-within:ring-2 focus-within:ring-ring"
									>
										<CheckboxControl class="absolute top-2 right-2 bg-background" />
										<CheckboxLabel class="block cursor-pointer p-1.5 text-sm data-[disabled]:cursor-default">
											<img
												alt=""
												loading="lazy"
												src={pixivImageHref(props.apiBase, page.preview)}
												class="aspect-video w-full rounded-sm object-contain"
											/>
											{t("pixivArtworkDetail.pageNumber", {
												page: index() + 1,
											})}
										</CheckboxLabel>
										<Show when={status()}>
											{(message) => (
												<CheckboxDescription class="block px-1.5 pb-1.5 text-xs text-muted-foreground">
													{message()}
												</CheckboxDescription>
											)}
										</Show>
									</Checkbox>
								);
							}}
						</For>
					</fieldset>
					<Button
						type="submit"
						class="max-w-full whitespace-normal"
						disabled={!selectedPages().length}
					>
						{t("pixivArtworkDetail.addSelectedPages", {
							count: selectedPages().length,
						})}
					</Button>
				</form>
			</CollapsibleContent>
		</Collapsible>
	);
}

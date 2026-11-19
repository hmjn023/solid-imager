import {
	TAG_DICTIONARY_PAGE_SIZE,
	type TagDictionaryLegacyResult,
	type TagDictionaryLegacySearch,
	type TagDictionaryMigration,
} from "@solid-imager/core/tags";
import { t } from "@solid-imager/i18n";
import { createMutation, createQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ErrorState } from "../../async-state";
import { Button } from "../../button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../../collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import { TAG_DICTIONARY_QUERY_KEY } from "../../query-options/tags-query";
import {
	TagDictionaryBrowser,
	type TagDictionaryLookup,
} from "../../tag-dictionary-browser";
import { TextField, TextFieldInput, TextFieldLabel } from "../../text-field";
import { ChevronDown } from "../../workspace/icons";

export type LegacyTagMigrationActions = TagDictionaryLookup & {
	dictionaryLegacy: (
		input: TagDictionaryLegacySearch,
		options?: { signal: AbortSignal },
	) => Promise<TagDictionaryLegacyResult>;
	dictionaryMigrate: (
		input: TagDictionaryMigration,
	) => Promise<{ success: true }>;
};

type LegacyTag = TagDictionaryLegacyResult["items"][number];

export function LegacyTagMigration(props: {
	actions: LegacyTagMigrationActions;
	onMigrated: () => void;
}) {
	const [open, setOpen] = createSignal(false);
	const [draft, setDraft] = createSignal("");
	const [query, setQuery] = createSignal("");
	const [offset, setOffset] = createSignal(0);
	const [source, setSource] = createSignal<LegacyTag>();
	const [target, setTarget] = createSignal("");
	const [done, setDone] = createSignal<{ source: string; target: string }>();
	let listTrigger: HTMLButtonElement | undefined;
	let editTrigger: HTMLButtonElement | undefined;
	const legacy = createQuery(() => {
		const input = { query: query(), offset: offset() };
		return {
			queryKey: [...TAG_DICTIONARY_QUERY_KEY, "legacy", input],
			queryFn: ({ signal }) =>
				props.actions.dictionaryLegacy(input, { signal }),
			enabled: !isServer && open(),
		};
	});
	const migrate = createMutation(() => ({
		mutationFn: (input: TagDictionaryMigration) =>
			props.actions.dictionaryMigrate(input),
		onSuccess: (_result, input) => {
			setDone({ source: input.sourceName, target: input.target });
			editTrigger = undefined;
			setSource(undefined);
			props.onMigrated();
		},
		onError: () => void legacy.refetch(),
	}));
	createEffect(() => {
		if (
			offset() > 0 &&
			legacy.isSuccess &&
			!legacy.isFetching &&
			legacy.data.items.length === 0
		) {
			setOffset(offset() - TAG_DICTIONARY_PAGE_SIZE);
		}
	});
	const close = () => {
		if (!migrate.isPending) setSource(undefined);
	};

	return (
		<Collapsible
			open={open()}
			onOpenChange={setOpen}
			class="rounded-lg border border-border bg-card"
		>
			<h3>
				<CollapsibleTrigger
					as={Button}
					variant="ghost"
					class="group min-h-11 w-full justify-between px-4"
					ref={(element: HTMLButtonElement) => {
						listTrigger = element;
					}}
				>
					{t("tagDictionary.legacyTitle")}
					<ChevronDown
						class="text-muted-foreground group-data-[expanded]:rotate-180"
						size={16}
					/>
				</CollapsibleTrigger>
			</h3>
			<CollapsibleContent class="space-y-3 border-t border-border p-3">
				<p class="text-sm text-muted-foreground">
					{t("tagDictionary.legacyHelp")}
				</p>
				<form
					class="flex flex-wrap items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						setQuery(draft().trim());
						setOffset(0);
					}}
				>
					<TextField value={draft()} onChange={setDraft} class="min-w-0 flex-1">
						<TextFieldLabel>{t("tagDictionary.legacySearch")}</TextFieldLabel>
						<TextFieldInput maxLength={200} type="search" />
					</TextField>
					<Button type="submit" class="min-h-11 sm:min-h-9">
						{t("actions.search")}
					</Button>
				</form>
				<div aria-live="polite" class="text-sm">
					<Show when={done()}>
						{(result) => t("tagDictionary.migrationDone", result())}
					</Show>
				</div>
				<Show when={legacy.isPending}>
					<p class="text-sm text-muted-foreground">{t("status.loading")}</p>
				</Show>
				<Show when={legacy.isError}>
					<ErrorState
						title={t("tagDictionary.legacyError")}
						onRetry={() => void legacy.refetch()}
					/>
				</Show>
				<Show when={legacy.isSuccess && legacy.data.items.length === 0}>
					<p class="text-sm text-muted-foreground">
						{t(
							query() ? "tagDictionary.noMatches" : "tagDictionary.legacyEmpty",
						)}
					</p>
				</Show>
				<Show when={legacy.data?.items.length}>
					<ul class="divide-y divide-border rounded-lg border border-border">
						<For each={legacy.data?.items}>
							{(item) => (
								<li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
									<span class="min-w-0 break-all text-sm font-medium">
										{item.name}
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="min-h-11 sm:min-h-9"
										aria-label={t("tagDictionary.pickMigrationFor", {
											name: item.name,
										})}
										onClick={(event) => {
											editTrigger = event.currentTarget;
											migrate.reset();
											setTarget("");
											setSource(item);
										}}
									>
										{t("tagDictionary.pickMigration")}
									</Button>
								</li>
							)}
						</For>
					</ul>
				</Show>
				<Show when={offset() > 0 || legacy.data?.hasMore}>
					<div class="flex justify-between gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={offset() === 0}
							onClick={() => setOffset(offset() - TAG_DICTIONARY_PAGE_SIZE)}
						>
							{t("actions.previous")}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={!legacy.data?.hasMore}
							onClick={() => setOffset(offset() + TAG_DICTIONARY_PAGE_SIZE)}
						>
							{t("actions.next")}
						</Button>
					</div>
				</Show>
				<Dialog
					open={Boolean(source())}
					onOpenChange={(next) => {
						if (!next) close();
					}}
				>
					<Show when={source()} keyed>
						{(item) => (
							<DialogContent
								class="sm:max-w-2xl"
								onCloseAutoFocus={(event) => {
									event.preventDefault();
									(editTrigger?.isConnected
										? editTrigger
										: listTrigger
									)?.focus();
								}}
							>
								<DialogHeader>
									<DialogTitle>
										{target()
											? t("tagDictionary.migrationTitle")
											: t("tagDictionary.pickMigrationFor", {
													name: item.name,
												})}
									</DialogTitle>
									<DialogDescription>
										{target()
											? t("tagDictionary.migrationConfirm", {
													source: item.name,
													target: target(),
												})
											: t("tagDictionary.searchLabel")}
									</DialogDescription>
								</DialogHeader>
								<Show
									when={target()}
									fallback={
										<TagDictionaryBrowser
											api={props.actions}
											actionLabel={t("tagDictionary.selectMigration")}
											onAdd={(entry) => setTarget(entry.name)}
										/>
									}
								>
									<Show when={migrate.isError}>
										<p role="alert" class="text-sm text-destructive">
											{t("tagDictionary.migrationError")}
										</p>
									</Show>
									<DialogFooter>
										<Button
											type="button"
											variant="outline"
											disabled={migrate.isPending}
											ref={(cancel) => queueMicrotask(() => cancel.focus())}
											onClick={close}
										>
											{t("actions.cancel")}
										</Button>
										<Button
											type="button"
											disabled={migrate.isPending}
											onClick={() =>
												migrate.mutate({
													tagId: item.id,
													sourceName: item.name,
													target: target(),
												})
											}
										>
											{t(
												migrate.isPending
													? "status.saving"
													: "tagDictionary.migrate",
											)}
										</Button>
									</DialogFooter>
								</Show>
							</DialogContent>
						)}
					</Show>
				</Dialog>
			</CollapsibleContent>
		</Collapsible>
	);
}

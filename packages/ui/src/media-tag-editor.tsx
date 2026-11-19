import type { UpdatePositiveMediaTags } from "@solid-imager/core/media";
import { getErrorMessage } from "@solid-imager/core/utils";
import { t } from "@solid-imager/i18n";
import { createQuery } from "@tanstack/solid-query";
import X from "lucide-solid/icons/x";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSX,
	Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import {
	Combobox,
	ComboboxControl,
	ComboboxInlineListbox,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	ComboboxLabel,
	useComboboxContext,
} from "./combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { TAG_DICTIONARY_QUERY_KEY } from "./query-options/tags-query";
import type { TagDictionaryLookup } from "./tag-dictionary-browser";
import { createDebouncedSignal } from "./utils/debounce";
import { Plus } from "./workspace/icons";

type TagUpdate = Pick<UpdatePositiveMediaTags, "entries" | "expected">;
type TagOption = {
	name: string;
	label: string;
	fromDictionary: boolean;
	japanese?: string | null;
};

function TagEntryInput(props: {
	value: string;
	hintId: string;
	onDismiss: () => void;
	onPaste: JSX.EventHandler<HTMLInputElement, ClipboardEvent>;
	inputRef: (element: HTMLInputElement) => void;
}) {
	const context = useComboboxContext();
	createEffect(() => context.setInputValue(props.value));
	return (
		<ComboboxInput
			ref={props.inputRef}
			aria-describedby={props.hintId}
			class="min-w-0 flex-1 text-base sm:text-sm"
			name="tag"
			spellcheck={false}
			autocomplete="off"
			autocapitalize="none"
			autocorrect="off"
			onPaste={props.onPaste}
			on:keydown={(
				event: KeyboardEvent & { currentTarget: HTMLInputElement },
			) => {
				if (
					event.isComposing ||
					// oxlint-disable-next-line typescript/no-deprecated -- Safari can report IME confirmation only through keyCode 229.
					(event.key === "Enter" && event.keyCode === 229)
				) {
					event.stopPropagation();
					return;
				}
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					if (context.isOpen()) context.close();
					else props.onDismiss();
				} else if (
					event.key === "Enter" &&
					context.isOpen() &&
					!event.currentTarget.getAttribute("aria-activedescendant")
				) {
					event.preventDefault();
					event.stopPropagation();
					event.currentTarget.form?.requestSubmit();
				}
			}}
		/>
	);
}

export function MediaTagEditor(props: {
	tags: TagUpdate["expected"];
	dictionary?: TagDictionaryLookup;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDirtyChange: (dirty: boolean) => void;
	onSave: (tags: TagUpdate) => Promise<void>;
	onUpdated?: () => void;
}) {
	const [input, setInput] = createSignal("");
	const [expected, setExpected] = createSignal<TagUpdate["expected"]>([]);
	const [assignments, setAssignments] = createSignal<
		ReadonlyMap<string, boolean>
	>(new Map());
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const [confirm, setConfirm] = createSignal(false);
	const [suggestionsOpen, setSuggestionsOpen] = createSignal(false);
	const [query, setQuery] = createDebouncedSignal("", 200);
	const hintId = createUniqueId();
	const names = createMemo(() => [...assignments().keys()]);
	const initialNames = createMemo(
		() => new Set(expected().map(({ name }) => name)),
	);
	const pendingName = () => input().trim();
	const dictionary = createQuery(() => {
		const search = props.dictionary?.dictionarySearch;
		const key = query();
		return {
			queryKey: [
				...TAG_DICTIONARY_QUERY_KEY,
				"search",
				{ query: key, offset: 0 },
			],
			queryFn: async ({ signal }) =>
				(await search?.({ query: key, offset: 0 }, { signal })) ?? {
					items: [],
					hasMore: false,
				},
			enabled:
				!isServer &&
				props.open &&
				Boolean(search) &&
				key.length > 0 &&
				key.length <= 200 &&
				key === pendingName(),
			staleTime: 60_000,
		};
	});
	const dirty = () =>
		(pendingName().length > 0 && !assignments().has(pendingName())) ||
		assignments().size !== initialNames().size ||
		[...assignments()].some(
			([name, fromDictionary]) => fromDictionary || !initialNames().has(name),
		);
	let assignedHeading: HTMLHeadingElement | undefined;
	let entryInput: HTMLInputElement | undefined;

	createEffect(() => props.onDirtyChange(props.open && (dirty() || saving())));

	const clearInput = () => {
		setInput("");
		setQuery("");
		setSuggestionsOpen(false);
	};
	const begin = () => {
		setExpected(props.tags.map(({ id, name }) => ({ id, name })));
		setAssignments(new Map(props.tags.map(({ name }) => [name, false])));
		clearInput();
		setError(undefined);
		setConfirm(false);
		props.onOpenChange(true);
	};
	const requestClose = () => {
		if (saving()) return;
		if (dirty()) setConfirm(true);
		else props.onOpenChange(false);
	};
	const addManualTags = (names: string[]) => {
		setAssignments((current) => {
			const next = new Map(current);
			for (const name of names) {
				if (name && !next.has(name)) next.set(name, false);
			}
			return next;
		});
	};
	const commitInput = () => {
		if (saving() || !pendingName()) return;
		addManualTags([pendingName()]);
		clearInput();
	};
	const removeTag = (name: string) => {
		assignedHeading?.focus({ preventScroll: true });
		setAssignments((current) => {
			const next = new Map(current);
			next.delete(name);
			return next;
		});
	};
	const assignedFromDictionary = (name: string) =>
		assignments().has(name) &&
		(assignments().get(name) === true || initialNames().has(name));
	const options = createMemo(() => {
		const name = pendingName();
		const result: TagOption[] = [];
		if (!name) return result;
		if (!assignments().has(name)) {
			result.push({
				name,
				label: t("mediaTagEditor.createTag", { name }),
				fromDictionary: false,
			});
		}
		if (props.dictionary && query() === name) {
			const entries = dictionary.data?.items ?? [];
			for (const entry of entries) {
				if (assignedFromDictionary(entry.name)) continue;
				result.push({
					name: entry.name,
					label: entry.name,
					fromDictionary: true,
					japanese: entry.japanese,
				});
				if (result.length >= 9) break;
			}
		}
		return result;
	});
	const menuVisible = () =>
		suggestionsOpen() && options().length > 0 && !confirm() && !saving();
	const selectOption = (option: TagOption | null) => {
		if (!option || saving()) return;
		if (option.fromDictionary) {
			setAssignments((current) =>
				new Map(current).set(option.name, !initialNames().has(option.name)),
			);
		} else {
			addManualTags([option.name]);
		}
		clearInput();
	};
	const save = async () => {
		if (saving() || !dirty()) return;
		commitInput();
		setSaving(true);
		setError(undefined);
		try {
			await props.onSave({
				expected: expected(),
				entries: [...assignments()].map(([name, fromDictionary]) => ({
					name,
					fromDictionary,
				})),
			});
			props.onOpenChange(false);
			props.onUpdated?.();
		} catch (cause) {
			setError(
				t("mediaSidebar.failedToUpdateTagsValue", {
					value0: getErrorMessage(cause),
				}),
			);
		} finally {
			setSaving(false);
		}
	};

	const renderInput = () => (
		<form
			aria-label={t("mediaTagEditor.tagNames")}
			onFocusOut={(event) => {
				const next = event.relatedTarget;
				if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
					setSuggestionsOpen(false);
				}
			}}
			onSubmit={(event) => {
				event.preventDefault();
				entryInput?.focus({ preventScroll: true });
				commitInput();
			}}
		>
			<Combobox<TagOption>
				class="min-w-0 space-y-2"
				disabled={saving()}
				defaultFilter={() => true}
				noResetInputOnBlur
				onChange={selectOption}
				onInputChange={(value) => {
					setInput(value);
					setQuery(value.trim());
					setSuggestionsOpen(Boolean(value.trim()));
				}}
				onOpenChange={setSuggestionsOpen}
				open={menuVisible()}
				optionLabel="label"
				optionTextValue="label"
				optionValue={(item) =>
					(item.fromDictionary ? "dictionary-" : "new-") +
					encodeURIComponent(item.name)
				}
				options={options()}
				triggerMode="focus"
				value={null}
				itemComponent={(item) => (
					<ComboboxItem item={item.item} class="gap-2">
						<Show when={!item.item.rawValue.fromDictionary}>
							<Plus class="shrink-0 text-primary" size={16} />
						</Show>
						<ComboboxItemLabel class="min-w-0 flex-1 wrap-anywhere">
							<span class="block font-medium">{item.item.rawValue.label}</span>
							<Show when={item.item.rawValue.japanese}>
								<span class="block text-xs text-muted-foreground">
									{item.item.rawValue.japanese}
								</span>
							</Show>
						</ComboboxItemLabel>
						<Show when={item.item.rawValue.fromDictionary}>
							<span class="shrink-0 text-xs text-muted-foreground">
								{t("tagDictionary.title")}
							</span>
						</Show>
					</ComboboxItem>
				)}
			>
				<ComboboxLabel>{t("mediaTagEditor.tagNames")}</ComboboxLabel>
				<p id={hintId} class="text-sm text-muted-foreground">
					{t("mediaTagEditor.entryHelp")}
				</p>
				<div class="flex items-center gap-2">
					<ComboboxControl<TagOption> class="min-h-11 min-w-0 flex-1 border-input bg-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
						<TagEntryInput
							inputRef={(element) => {
								entryInput = element;
							}}
							value={input()}
							hintId={hintId}
							onDismiss={requestClose}
							onPaste={(event) => {
								const text = event.clipboardData?.getData("text/plain");
								if (saving() || !text || !/[\r\n]/u.test(text)) return;
								event.preventDefault();
								addManualTags(
									text.split(/[\r\n]+/u).map((name) => name.trim()),
								);
							}}
						/>
					</ComboboxControl>
					<Button type="submit" disabled={saving() || !pendingName()}>
						{t("actions.add")}
					</Button>
				</div>
				<Show when={menuVisible()}>
					<ComboboxInlineListbox />
				</Show>
			</Combobox>
			<Show
				when={
					props.dictionary && query() === pendingName() && dictionary.isError
				}
			>
				<p aria-live="polite" class="mt-2 text-xs text-muted-foreground">
					{t("tagDictionary.searchError")}
				</p>
			</Show>
		</form>
	);

	return (
		<>
			<Dialog
				open={props.open}
				onOpenChange={(open) => (open ? begin() : requestClose())}
			>
				<DialogTrigger as={Button} size="sm" variant="outline">
					{t("actions.edit")}
				</DialogTrigger>
				<DialogContent class="workspace-theme flex h-dialog-screen max-w-3xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0 sm:h-144 [&>button]:top-2 [&>button]:right-2 [&>button]:z-20 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center">
					<DialogHeader class="border-b border-border bg-card p-4 pr-14 text-start sm:px-5 sm:pr-14">
						<DialogTitle>{t("mediaTagEditor.title")}</DialogTitle>
						<DialogDescription>
							{t("mediaTagEditor.description")}
						</DialogDescription>
					</DialogHeader>
					<div class="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain bg-background p-3 md:grid-cols-3 md:items-start sm:p-5">
						<section class="min-w-0 rounded-lg border border-border bg-muted/50 p-3">
							<h3
								class="font-semibold text-sm"
								ref={(heading) => {
									assignedHeading = heading;
								}}
								tabIndex={-1}
								aria-live="polite"
							>
								{t("mediaTagEditor.assignedCount", { count: names().length })}
							</h3>
							<Show
								when={names().length > 0}
								fallback={
									<p class="mt-1 text-sm text-muted-foreground">
										{t("mediaSidebar.noPositiveTags")}
									</p>
								}
							>
								<ul class="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto overscroll-contain p-1 md:max-h-80">
									<For each={names()}>
										{(name) => (
											<li class="min-w-0 max-w-full">
												<Button
													type="button"
													size="sm"
													variant="outline"
													class="h-auto min-h-11 max-w-full gap-2 whitespace-normal border-primary/20 bg-accent px-2 py-1.5 text-start text-accent-foreground hover:bg-muted sm:min-h-8"
													aria-label={t("mediaTagEditor.removeName", { name })}
													disabled={saving()}
													onClick={() => removeTag(name)}
												>
													<span class="min-w-0 wrap-anywhere">{name}</span>
													<X aria-hidden="true" size={14} />
												</Button>
											</li>
										)}
									</For>
								</ul>
							</Show>
						</section>
						<div class="min-w-0 md:col-span-2">{renderInput()}</div>
					</div>
					<Show when={error()}>
						<p
							role="alert"
							class="shrink-0 border-t bg-error px-4 py-2 text-sm text-error-foreground wrap-anywhere"
						>
							{error()}
						</p>
					</Show>
					<DialogFooter class="flex-row justify-end border-t border-border bg-card px-3 py-3 sm:px-5 [&>button]:w-auto">
						<Button
							type="button"
							variant="outline"
							disabled={saving()}
							onClick={requestClose}
						>
							{t("actions.cancel")}
						</Button>
						<Button
							type="button"
							aria-busy={saving()}
							disabled={saving() || !dirty()}
							onClick={() => void save()}
						>
							{saving() ? t("status.saving") : t("actions.save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AlertDialog open={props.open && confirm()} onOpenChange={setConfirm}>
				<AlertDialogContent class="workspace-theme rounded-lg">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("relationsEditor.discardChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("mediaTagEditor.unsavedChanges")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirm(false);
								props.onOpenChange(false);
							}}
						>
							{t("actions.discard")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

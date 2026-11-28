import { getErrorMessage } from "@solid-imager/core/utils";
import { t } from "@solid-imager/i18n";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Alert, AlertDescription } from "./alert";
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
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { SelectedRelationItems } from "./selected-relation-items";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Plus, Search } from "./workspace/icons";

const RELATION_GROUPS = ["projects", "ips", "characters"] as const;
type RelationGroup = (typeof RELATION_GROUPS)[number];
type NamedItem = { id: string; name: string };
type Item = NamedItem & { ips?: NamedItem[] };
type Group = {
	title: string;
	items: Item[];
	available: Item[];
	add: (id: string) => void | Promise<void>;
	remove: (id: string) => void | Promise<void>;
	create: (name: string) => Promise<{ id: string }>;
};
type Draft = { ids: string[]; names: string[]; query: string };
type Props = {
	groups: Record<RelationGroup, Group>;
	onUpdate?: () => void;
	onDirtyChange?: (dirty: boolean) => void;
	disabled?: boolean;
};

function groupDraft(group: Group): Draft {
	return { ids: group.items.map((item) => item.id), names: [], query: "" };
}

function RelationGroupPanel(props: {
	group: Group;
	createdItems: Item[];
	draft: Draft;
	characters: boolean;
	saving: boolean;
	onQuery: (query: string) => void;
	onToggle: (id: string, checked: boolean) => void;
	onStageName: (name: string) => void;
	onRemoveName: (name: string) => void;
	searchRef: (input: HTMLInputElement) => void;
}) {
	const items = createMemo(() => [
		...new Map(
			[
				...props.group.items,
				...props.group.available,
				...props.createdItems,
			].map((item) => [item.id, item]),
		).values(),
	]);
	const selected = () =>
		items().filter((item) => props.draft.ids.includes(item.id));
	const searchName = () => props.draft.query.trim();
	const normalizedQuery = () => searchName().toLowerCase();
	const candidates = createMemo(() => {
		const query = normalizedQuery();
		return items().filter(
			(item) =>
				item.name.toLowerCase().includes(query) ||
				item.ips?.some((ip) => ip.name.toLowerCase().includes(query)),
		);
	});
	const canStageName = () =>
		searchName() &&
		!items().some((item) => item.name.toLowerCase() === normalizedQuery()) &&
		!props.draft.names.some((name) => name.toLowerCase() === normalizedQuery());
	let searchInput: HTMLInputElement | undefined;

	return (
		<div class="grid min-w-0 content-start gap-4 md:grid-cols-3">
			<SelectedRelationItems
				items={selected()}
				staged={{ names: props.draft.names, onRemove: props.onRemoveName }}
				disabled={props.saving}
				onRemove={(id) => props.onToggle(id, false)}
			/>

			<section class="min-w-0 space-y-3 md:col-span-2">
				<div class="space-y-1">
					<h3 class="font-semibold text-sm">
						{t("relationsEditor.candidates")}
					</h3>
					<Show when={props.characters}>
						<p class="text-xs text-muted-foreground">
							{t("relationsEditor.characterIpHint")}
						</p>
					</Show>
				</div>
				<div class="relative">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						size={16}
					/>
					<Input
						ref={(input) => {
							searchInput = input;
							props.searchRef(input);
						}}
						type="search"
						class="bg-card pl-9 shadow-none"
						aria-label={t("relationsEditor.searchValue", {
							value0: props.group.title,
						})}
						placeholder={t(
							props.characters
								? "relationsEditor.characterSearchHint"
								: "relationsEditor.nameSearchHint",
						)}
						value={props.draft.query}
						disabled={props.saving}
						onInput={(event) => props.onQuery(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && canStageName() && !props.saving) {
								event.preventDefault();
								props.onStageName(searchName());
							}
						}}
					/>
				</div>
				<Show when={canStageName()}>
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="h-auto min-h-11 max-w-full whitespace-normal py-2 text-start sm:min-h-9"
						disabled={props.saving}
						onClick={() => {
							searchInput?.focus({ preventScroll: true });
							props.onStageName(searchName());
						}}
					>
						<Plus size={16} />
						<span class="min-w-0 wrap-anywhere">
							{t("relationsEditor.createValue", { value0: searchName() })}
						</span>
					</Button>
				</Show>
				<Show
					when={candidates().length > 0}
					fallback={
						<p class="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
							{t(
								searchName()
									? "relationsEditor.noMatches"
									: "relationsEditor.noCandidates",
							)}
						</p>
					}
				>
					<ul class="divide-y divide-border rounded-md border border-border bg-card">
						<For each={candidates()}>
							{(item) => (
								<li>
									<Checkbox
										class="flex min-h-11 min-w-0 items-center gap-2.5 rounded-sm px-3 hover:bg-muted data-[checked]:bg-accent/60"
										checked={props.draft.ids.includes(item.id)}
										disabled={props.saving}
										onChange={(checked) => props.onToggle(item.id, checked)}
									>
										<CheckboxControl />
										<CheckboxLabel class="min-w-0 flex-1 cursor-pointer self-stretch py-2.5 text-sm">
											<span class="block font-medium wrap-anywhere">
												{item.name}
											</span>
											<Show when={item.ips?.length}>
												<span class="block text-xs text-muted-foreground wrap-anywhere">
													{item.ips?.map((ip) => ip.name).join(" / ")}
												</span>
											</Show>
										</CheckboxLabel>
									</Checkbox>
								</li>
							)}
						</For>
					</ul>
				</Show>
			</section>
		</div>
	);
}

export function RelationsEditor(props: Props) {
	const [open, setOpen] = createSignal(false);
	const [confirm, setConfirm] = createSignal(false);
	const [saving, setSaving] = createSignal(false);
	const [saveError, setSaveError] = createSignal<string | null>(null);
	const [active, setActive] = createSignal<RelationGroup>("ips");
	const readDraft = () => ({
		projects: groupDraft(props.groups.projects),
		ips: groupDraft(props.groups.ips),
		characters: groupDraft(props.groups.characters),
	});
	const emptyDraft: Record<RelationGroup, Draft> = {
		projects: { ids: [], names: [], query: "" },
		ips: { ids: [], names: [], query: "" },
		characters: { ids: [], names: [], query: "" },
	};
	const [baseline, setBaseline] = createSignal(emptyDraft);
	const [drafts, setDrafts] = createSignal(emptyDraft);
	const [createdItems, setCreatedItems] = createSignal<
		Record<RelationGroup, Item[]>
	>({
		projects: [],
		ips: [],
		characters: [],
	});
	let initialSearch: HTMLInputElement | undefined;
	const updateDraft = (key: RelationGroup, update: (draft: Draft) => Draft) =>
		setDrafts((previous) => ({ ...previous, [key]: update(previous[key]) }));
	const dirty = createMemo(() =>
		RELATION_GROUPS.some((key) => {
			const initialIds = baseline()[key].ids;
			const draft = drafts()[key];
			return (
				draft.names.length > 0 ||
				initialIds.length !== draft.ids.length ||
				initialIds.some((id) => !draft.ids.includes(id))
			);
		}),
	);
	createEffect(
		() => ({
			onDirtyChange: props.onDirtyChange,
			dirty: open() && (dirty() || saving()),
		}),
		({ onDirtyChange, dirty }) => {
			onDirtyChange?.(dirty);
		},
	);
	const begin = () => {
		const initial = readDraft();
		setBaseline(initial);
		setDrafts(initial);
		setCreatedItems({ projects: [], ips: [], characters: [] });
		setSaveError(null);
		setActive("ips");
		setOpen(true);
	};
	const requestClose = () => {
		if (saving()) return;
		if (dirty()) setConfirm(true);
		else setOpen(false);
	};
	const toggle = (key: RelationGroup, id: string, checked: boolean) => {
		if (saving()) return;
		setDrafts((previous) => {
			const group = previous[key];
			const ids = checked
				? [...new Set([...group.ids, id])]
				: group.ids.filter((value) => value !== id);
			const next = { ...previous, [key]: { ...group, ids } };
			if (key === "characters" && checked) {
				const ips =
					props.groups.characters.available.find((item) => item.id === id)
						?.ips ?? [];
				next.ips = {
					...next.ips,
					ids: [...new Set([...next.ips.ids, ...ips.map((ip) => ip.id)])],
				};
			}
			return next;
		});
	};
	const save = async () => {
		if (saving() || !dirty()) return;
		setSaveError(null);
		setSaving(true);
		let anySucceeded = false;
		const commitBaselineId = (
			key: RelationGroup,
			update: (ids: string[]) => string[],
		) => {
			setBaseline((previous) => ({
				...previous,
				[key]: { ...previous[key], ids: update(previous[key].ids) },
			}));
		};
		try {
			for (const key of RELATION_GROUPS) {
				const group = props.groups[key];
				const baselineIds = baseline()[key].ids;
				const draft = drafts()[key];
				const toRemove = baselineIds.filter((id) => !draft.ids.includes(id));
				const toAdd = draft.ids.filter((id) => !baselineIds.includes(id));
				const namesToCreate = [...draft.names];
				for (const id of toRemove) {
					await group.remove(id);
					anySucceeded = true;
					commitBaselineId(key, (ids) => ids.filter((value) => value !== id));
				}
				for (const id of toAdd) {
					await group.add(id);
					anySucceeded = true;
					commitBaselineId(key, (ids) => [...new Set([...ids, id])]);
				}
				for (const name of namesToCreate) {
					const item = await group.create(name);
					anySucceeded = true;
					setCreatedItems((previous) => ({
						...previous,
						[key]: [...previous[key], { id: item.id, name }],
					}));
					setDrafts((previous) => ({
						...previous,
						[key]: {
							...previous[key],
							ids: [...new Set([...previous[key].ids, item.id])],
							names: previous[key].names.filter((value) => value !== name),
						},
					}));
					await group.add(item.id);
					commitBaselineId(key, (ids) => [...new Set([...ids, item.id])]);
				}
			}
			props.onUpdate?.();
			setOpen(false);
		} catch (error) {
			if (anySucceeded) {
				props.onUpdate?.();
			}
			setSaveError(
				t("relationsEditor.partialSaveRetryHint", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setSaving(false);
		}
	};
	return (
		<>
			<Dialog
				open={open()}
				onOpenChange={(value) => (value ? begin() : requestClose())}
			>
				<DialogTrigger
					as={Button}
					size="sm"
					variant="outline"
					disabled={props.disabled}
				>
					{t("actions.edit")}
				</DialogTrigger>
				<DialogContent
					class="workspace-theme flex h-dialog-screen max-w-3xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0 sm:h-120 [&>button]:top-2 [&>button]:right-2 [&>button]:z-20 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center"
					closeDisabled={saving()}
					onOpenAutoFocus={(event) => {
						if (
							initialSearch?.isConnected &&
							!window.matchMedia("(pointer: coarse)").matches
						) {
							event.preventDefault();
							initialSearch.focus({ preventScroll: true });
						}
					}}
				>
					<DialogHeader class="border-b border-border bg-card p-4 pr-14 text-start sm:px-5 sm:pr-14">
						<DialogTitle>{t("relationsEditor.editRelations")}</DialogTitle>
						<DialogDescription>
							{t("relationsEditor.editHelp")}
						</DialogDescription>
					</DialogHeader>
					<Tabs
						class="flex min-h-0 flex-1 flex-col"
						value={active()}
						onChange={setActive}
					>
						<div class="shrink-0 border-b border-border bg-card px-3 py-2 sm:px-5">
							<TabsList
								aria-label={t("mediaSidebar.relations")}
								class="grid w-full grid-cols-3 gap-1"
							>
								<For each={RELATION_GROUPS}>
									{(key) => (
										<TabsTrigger
											value={key}
											class="min-h-11 min-w-0 flex-col gap-0.5 px-0.5 text-xs data-[selected]:bg-accent data-[selected]:text-accent-foreground sm:min-h-9 sm:flex-row sm:gap-2 sm:px-2 sm:text-sm"
										>
											{props.groups[key].title}
											<span class="rounded-full bg-card px-1.5 text-xs tabular-nums">
												{drafts()[key].ids.length + drafts()[key].names.length}
											</span>
										</TabsTrigger>
									)}
								</For>
							</TabsList>
						</div>
						<For each={RELATION_GROUPS}>
							{(key) => (
								<TabsContent
									value={key}
									class="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background p-3 sm:p-5"
								>
									<RelationGroupPanel
										group={props.groups[key]}
										createdItems={createdItems()[key]}
										draft={drafts()[key]}
										characters={key === "characters"}
										saving={saving()}
										onQuery={(query) =>
											updateDraft(key, (draft) => ({ ...draft, query }))
										}
										onToggle={(id, checked) => toggle(key, id, checked)}
										onStageName={(name) =>
											updateDraft(key, (draft) => ({
												...draft,
												names: [...draft.names, name],
												query: "",
											}))
										}
										onRemoveName={(name) =>
											updateDraft(key, (draft) => ({
												...draft,
												names: draft.names.filter((value) => value !== name),
											}))
										}
										searchRef={(input) => {
											if (key === "ips") initialSearch = input;
										}}
									/>
								</TabsContent>
							)}
						</For>
					</Tabs>
					<Show when={saveError()}>
						{(message) => (
							<div class="shrink-0 border-t border-border bg-card px-3 py-2 sm:px-5">
								<Alert class="bg-destructive/10 p-3" variant="destructive">
									<AlertDescription>{message()}</AlertDescription>
								</Alert>
							</div>
						)}
					</Show>
					<DialogFooter class="flex-row justify-end border-t border-border bg-card px-3 py-3 sm:px-5 [&>button]:w-auto">
						<Button
							class="min-h-11 sm:min-h-9"
							type="button"
							variant="outline"
							disabled={saving()}
							onClick={requestClose}
						>
							{t("actions.cancel")}
						</Button>
						<Button
							aria-busy={saving()}
							class="min-h-11 sm:min-h-9"
							type="button"
							disabled={saving() || !dirty()}
							onClick={() => void save()}
						>
							{saving() ? t("status.saving") : t("actions.saveChanges")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AlertDialog open={confirm()} onOpenChange={setConfirm}>
				<AlertDialogContent class="workspace-theme rounded-lg">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("relationsEditor.discardChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("relationsEditor.yourRelationChangesHaveNotBeenSaved")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirm(false);
								setOpen(false);
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

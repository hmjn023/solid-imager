import { getErrorMessage } from "@solid-imager/core/utils";
import { t } from "@solid-imager/i18n";
import { createMemo, createSignal, For, Show } from "solid-js";
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
import { toast } from "./toast";
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
	disabled?: boolean;
};

function groupDraft(group: Group): Draft {
	return { ids: group.items.map((item) => item.id), names: [], query: "" };
}

function RelationGroupPanel(props: {
	group: Group;
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
			[...props.group.items, ...props.group.available].map((item) => [
				item.id,
				item,
			]),
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
	const [active, setActive] = createSignal<RelationGroup>("ips");
	const readDraft = () => ({
		projects: groupDraft(props.groups.projects),
		ips: groupDraft(props.groups.ips),
		characters: groupDraft(props.groups.characters),
	});
	const [drafts, setDrafts] = createSignal(readDraft());
	let initialSearch: HTMLInputElement | undefined;
	const updateDraft = (key: RelationGroup, update: (draft: Draft) => Draft) =>
		setDrafts((previous) => ({ ...previous, [key]: update(previous[key]) }));
	const dirty = createMemo(() =>
		RELATION_GROUPS.some((key) => {
			const items = props.groups[key].items;
			const draft = drafts()[key];
			return (
				draft.names.length > 0 ||
				items.length !== draft.ids.length ||
				items.some((item) => !draft.ids.includes(item.id))
			);
		}),
	);
	const begin = () => {
		setDrafts(readDraft());
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
		const changes = drafts();
		setSaving(true);
		try {
			for (const key of RELATION_GROUPS) {
				const group = props.groups[key];
				const old = group.items.map((item) => item.id);
				const { ids, names } = changes[key];
				for (const id of old.filter((id) => !ids.includes(id)))
					await group.remove(id);
				for (const id of ids.filter((id) => !old.includes(id)))
					await group.add(id);
				for (const name of names) {
					const item = await group.create(name);
					await group.add(item.id);
				}
			}
			props.onUpdate?.();
			setOpen(false);
		} catch (error) {
			props.onUpdate?.();
			setOpen(false);
			toast.error(
				t("relationsEditor.failedToSaveRelationsSomeChangesMayHaveBeen", {
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

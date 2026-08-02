import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import Bot from "lucide-solid/icons/bot";
import CopyCheck from "lucide-solid/icons/copy-check";
import Download from "lucide-solid/icons/download";
import Folder from "lucide-solid/icons/folder";
import Image from "lucide-solid/icons/image";
import Pencil from "lucide-solid/icons/pencil";
import Plus from "lucide-solid/icons/plus";
import Search from "lucide-solid/icons/search";
import Share2 from "lucide-solid/icons/share-2";
import Trash2 from "lucide-solid/icons/trash-2";
import Upload from "lucide-solid/icons/upload";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../alert-dialog";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
	RetryButton,
} from "../async-state";
import { Badge } from "../badge";
import { Button } from "../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxItemLabel,
	ComboboxTrigger,
} from "../combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import type {
	ManagerEntity,
	ManagerEntityType,
	UseManagerPageResult,
} from "../hooks/use-manager-page";
import { Input } from "../input";
import { Label } from "../label";
import { Progress } from "../progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import { LoadingRegion } from "../skeleton";
import {
	V2CategoryLabel,
	V2ManagementHeader,
	v2CategoryButtonClass,
} from "../v2/management-layout";

type ManagerCategory = {
	description: string;
	group: "Entities" | "Tools";
	label: string;
	value: V2ManagerCategory;
};

type V2ManagerCategory = ManagerEntityType | "transfer";

export type V2ManagerTransferFormat = "ndjson" | "tar" | "lancedb";

export type V2ManagerTransferActions = {
	exportSource: (input: {
		format: V2ManagerTransferFormat;
		includeImages: boolean;
		sourceId: string;
	}) => Promise<void>;
	importSource: (input: {
		file: File;
		format: V2ManagerTransferFormat;
		sourceId: string;
	}) => Promise<{ importedCount?: number }>;
};

const MANAGER_CATEGORIES: ManagerCategory[] = [
	{
		description: "Collections and work",
		group: "Entities",
		label: "Projects",
		value: "projects",
	},
	{
		description: "Series and franchises",
		group: "Entities",
		label: "IPs",
		value: "ips",
	},
	{
		description: "People and subjects",
		group: "Entities",
		label: "Characters",
		value: "characters",
	},
	{
		description: "Submit AI tag jobs",
		group: "Tools",
		label: "Batch tagging",
		value: "tagging",
	},
	{
		description: "Build CCIP features",
		group: "Tools",
		label: "Vector extraction",
		value: "vectors",
	},
	{
		description: "Review matching media",
		group: "Tools",
		label: "Duplicates",
		value: "duplicates",
	},
	{
		description: "Export and restore source data",
		group: "Tools",
		label: "Data transfer",
		value: "transfer",
	},
];

const ALL_SOURCES_OPTION = { id: "__all__", name: "All sources" };

function isCrudCategory(value: V2ManagerCategory): value is ManagerEntityType {
	return value === "projects" || value === "ips" || value === "characters";
}

function isCharacter(item: ManagerEntity): item is Character {
	return "ips" in item;
}

function isIp(item: ManagerEntity): item is Ip {
	return "source" in item;
}

function categoryLabel(value: V2ManagerCategory): string {
	return (
		MANAGER_CATEGORIES.find((category) => category.value === value)?.label ??
		value
	);
}

function singularLabel(value: ManagerEntityType): string {
	switch (value) {
		case "projects":
			return "Project";
		case "ips":
			return "IP";
		case "characters":
			return "Character";
		default:
			return "Item";
	}
}

function formatDate(value: Date | string): string {
	return new Date(value).toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function ManagerCategoryIcon(props: { value: V2ManagerCategory }) {
	switch (props.value) {
		case "projects":
			return <Folder aria-hidden="true" size={16} />;
		case "ips":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "characters":
			return <Image aria-hidden="true" size={16} />;
		case "tagging":
			return <Bot aria-hidden="true" size={16} />;
		case "vectors":
			return <Share2 aria-hidden="true" size={16} />;
		case "duplicates":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "transfer":
			return <Share2 aria-hidden="true" size={16} />;
	}
}

function ManagerCategoryNavigation(props: {
	active: V2ManagerCategory;
	compact?: boolean;
	onChange: (value: V2ManagerCategory) => void;
}) {
	if (props.compact) {
		return (
			<nav
				aria-label="Manager categories"
				class="sticky top-0 z-10 flex gap-1 overflow-x-auto border-[var(--v2-border)] border-b bg-[var(--v2-canvas)]/95 px-3 py-2 backdrop-blur lg:hidden"
			>
				<For each={MANAGER_CATEGORIES}>
					{(category) => (
						<Button
							aria-current={
								props.active === category.value ? "page" : undefined
							}
							class={`min-h-11 shrink-0 gap-2.5 px-2.5 ${
								props.active === category.value
									? "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
									: "text-[var(--v2-text-secondary)]"
							}`}
							onClick={() => props.onChange(category.value)}
							variant="ghost"
						>
							<V2CategoryLabel
								description={category.description}
								icon={<ManagerCategoryIcon value={category.value} />}
								label={category.label}
							/>
						</Button>
					)}
				</For>
			</nav>
		);
	}

	return (
		<nav aria-label="Manager categories" class="hidden lg:block">
			<div class="sticky top-5 space-y-5">
				<For each={["Entities", "Tools"] as const}>
					{(group) => (
						<div>
							<p class="mb-1 px-2.5 font-medium text-[10px] uppercase tracking-[0.12em] text-[var(--v2-text-muted)]">
								{group}
							</p>
							<div class="space-y-0.5">
								<For
									each={MANAGER_CATEGORIES.filter(
										(category) => category.group === group,
									)}
								>
									{(category) => (
										<button
											aria-current={
												props.active === category.value ? "page" : undefined
											}
											class={v2CategoryButtonClass(
												props.active === category.value,
											)}
											onClick={() => props.onChange(category.value)}
											type="button"
										>
											<V2CategoryLabel
												description={category.description}
												icon={<ManagerCategoryIcon value={category.value} />}
												label={category.label}
											/>
										</button>
									)}
								</For>
							</div>
						</div>
					)}
				</For>
			</div>
		</nav>
	);
}

function ManagerTableSkeleton() {
	return (
		<LoadingRegion label="管理データを読み込んでいます...">
			<div class="overflow-hidden rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)]">
				<div class="h-9 animate-pulse bg-[var(--v2-surface-muted)] motion-reduce:animate-none" />
				<For each={[1, 2, 3, 4, 5]}>
					{() => (
						<div class="grid h-14 grid-cols-[2fr_3fr_1fr] gap-4 border-[var(--v2-border)] border-t px-4 py-3">
							<span class="rounded bg-[var(--v2-surface-muted)]" />
							<span class="rounded bg-[var(--v2-surface-muted)]" />
							<span class="rounded bg-[var(--v2-surface-muted)]" />
						</div>
					)}
				</For>
			</div>
		</LoadingRegion>
	);
}

function relationSummary(item: ManagerEntity): string {
	if (isCharacter(item)) {
		return item.ips.length > 0 ? item.ips.map((ip) => ip.name).join(", ") : "—";
	}
	if (isIp(item)) {
		return item.source || "—";
	}
	return "—";
}

function EntityInspector(props: {
	item: ManagerEntity;
	manager: UseManagerPageResult;
}) {
	const active = () => props.manager.activeTab();
	return (
		<aside
			aria-label="選択中の項目"
			class="hidden self-start rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4 2xl:block"
		>
			<p class="text-xs text-[var(--v2-text-muted)]">
				Selected {singularLabel(active())}
			</p>
			<h3 class="mt-1 break-words font-semibold text-base text-[var(--v2-text)]">
				{props.item.name}
			</h3>
			<p class="mt-2 text-xs leading-5 text-[var(--v2-text-secondary)]">
				{props.item.description || "No description"}
			</p>
			<dl class="mt-4 space-y-3 border-[var(--v2-border)] border-y py-4 text-xs">
				<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
					<dt class="text-[var(--v2-text-muted)]">ID</dt>
					<dd class="break-all text-[var(--v2-text)]">{props.item.id}</dd>
				</div>
				<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
					<dt class="text-[var(--v2-text-muted)]">Updated</dt>
					<dd class="text-[var(--v2-text)]">
						{formatDate(props.item.updatedAt)}
					</dd>
				</div>
				<Show when={isCharacter(props.item) || isIp(props.item)}>
					<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
						<dt class="text-[var(--v2-text-muted)]">
							{isCharacter(props.item) ? "IPs" : "Source"}
						</dt>
						<dd class="break-words text-[var(--v2-text)]">
							{relationSummary(props.item)}
						</dd>
					</div>
				</Show>
			</dl>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<Button
					aria-label={`${props.item.name}を編集`}
					onClick={() => props.manager.openEditDialog(props.item)}
					variant="outline"
				>
					<Pencil aria-hidden="true" size={14} />
					Edit
				</Button>
				<Button
					aria-label={`${props.item.name}を削除`}
					class="text-destructive"
					onClick={() => {
						props.manager.setItemToDelete(props.item);
						props.manager.setIsDeleteDialogOpen(true);
					}}
					variant="outline"
				>
					<Trash2 aria-hidden="true" size={14} />
					Delete
				</Button>
			</div>
		</aside>
	);
}

function EntityTablePanel(props: {
	manager: UseManagerPageResult;
	query: string;
	selectedId: string | null;
	onQueryChange: (value: string) => void;
	onSelect: (id: string) => void;
}) {
	const active = () => props.manager.activeTab();
	const items = createMemo(() => {
		const normalized = props.query.trim().toLocaleLowerCase();
		const activeItems = props.manager.getActiveItems();
		if (!normalized) return activeItems;
		return activeItems.filter((item) =>
			`${item.name} ${item.description ?? ""} ${relationSummary(item)}`
				.toLocaleLowerCase()
				.includes(normalized),
		);
	});
	const selectedItem = createMemo(
		() => items().find((item) => item.id === props.selectedId) ?? items()[0],
	);

	return (
		<div class="min-w-0">
			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 class="font-semibold text-lg text-[var(--v2-text)]">
						{categoryLabel(active())}
					</h2>
					<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
						Create, review, and maintain {categoryLabel(active()).toLowerCase()}
						.
					</p>
				</div>
				<Button
					class="w-full sm:w-auto"
					onClick={props.manager.openCreateDialog}
				>
					<Plus aria-hidden="true" size={15} />
					New {singularLabel(active())}
				</Button>
			</div>

			<div class="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_20rem]">
				<div class="min-w-0">
					<div class="relative mb-3">
						<Search
							aria-hidden="true"
							class="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--v2-text-muted)]"
							size={15}
						/>
						<Input
							aria-label={`${categoryLabel(active())}を検索`}
							class="h-9 bg-[var(--v2-surface)] pl-9 shadow-none"
							onInput={(event) =>
								props.onQueryChange(event.currentTarget.value)
							}
							placeholder={`Search ${categoryLabel(active()).toLowerCase()}...`}
							value={props.query}
						/>
					</div>

					<Show
						fallback={
							<EmptyState
								class="min-h-52"
								description="検索条件を変更するか、新しい項目を作成してください。"
								title={`${categoryLabel(active())}が見つかりません`}
							>
								<Button onClick={props.manager.openCreateDialog}>
									New {singularLabel(active())}
								</Button>
							</EmptyState>
						}
						when={items().length > 0}
					>
						<div class="overflow-x-auto rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] [scrollbar-gutter:stable]">
							<table class="w-full min-w-[46rem] border-collapse text-left text-sm">
								<caption class="sr-only">
									{categoryLabel(active())}の一覧。{items().length}件。
								</caption>
								<thead class="bg-[var(--v2-surface-muted)] text-xs text-[var(--v2-text-muted)]">
									<tr>
										<th class="px-3 py-2 font-medium" scope="col">
											Name
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											Description
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											{active() === "characters"
												? "IPs"
												: active() === "ips"
													? "Source"
													: "Status"}
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											Updated
										</th>
										<th class="px-3 py-2 text-right font-medium" scope="col">
											Actions
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-[var(--v2-border)]">
									<For each={items()}>
										{(item) => {
											const selected = () => selectedItem()?.id === item.id;
											return (
												<tr
													class={
														selected()
															? "bg-[var(--v2-surface-selected)]"
															: "hover:bg-[var(--v2-surface-muted)]"
													}
												>
													<th class="p-0 font-normal" scope="row">
														<button
															aria-pressed={selected()}
															class="block min-h-12 w-full px-3 py-2 text-left font-medium text-[var(--v2-text)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--v2-focus)]"
															onClick={() => props.onSelect(item.id)}
															type="button"
														>
															<span class="block max-w-52 truncate">
																{item.name}
															</span>
														</button>
													</th>
													<td class="max-w-[28rem] px-3 py-2 text-xs text-[var(--v2-text-secondary)]">
														<span class="line-clamp-2">
															{item.description || "No description"}
														</span>
													</td>
													<td class="max-w-52 px-3 py-2 text-xs text-[var(--v2-text-secondary)]">
														<span class="block truncate">
															{active() === "projects"
																? "Active"
																: relationSummary(item)}
														</span>
													</td>
													<td class="whitespace-nowrap px-3 py-2 text-xs text-[var(--v2-text-muted)]">
														{formatDate(item.updatedAt)}
													</td>
													<td class="px-3 py-2">
														<div class="flex justify-end gap-1">
															<Button
																aria-label={`${item.name}を編集`}
																class="size-8 p-0"
																onClick={() =>
																	props.manager.openEditDialog(item)
																}
																size="icon"
																variant="ghost"
															>
																<Pencil aria-hidden="true" size={14} />
															</Button>
															<Button
																aria-label={`${item.name}を削除`}
																class="size-8 p-0 text-destructive"
																onClick={() => {
																	props.manager.setItemToDelete(item);
																	props.manager.setIsDeleteDialogOpen(true);
																}}
																size="icon"
																variant="ghost"
															>
																<Trash2 aria-hidden="true" size={14} />
															</Button>
														</div>
													</td>
												</tr>
											);
										}}
									</For>
								</tbody>
							</table>
						</div>
						<p
							class="mt-2 text-xs text-[var(--v2-text-muted)]"
							aria-live="polite"
						>
							{items().length} items
						</p>
					</Show>
				</div>

				<Show when={selectedItem()}>
					{(item) => <EntityInspector item={item()} manager={props.manager} />}
				</Show>
			</div>
		</div>
	);
}

function SourceSelect(props: {
	manager: UseManagerPageResult;
	onChange: (id: string | undefined) => void;
	value: string | undefined;
}) {
	return (
		<Select
			itemComponent={(selectProps) => (
				<SelectItem item={selectProps.item}>
					{selectProps.item.rawValue.name}
				</SelectItem>
			)}
			onChange={(value) => props.onChange(value?.id)}
			options={props.manager.sources()}
			optionTextValue="name"
			optionValue="id"
			placeholder="All sources"
			value={
				props.value
					? props.manager.sources().find((source) => source.id === props.value)
					: null
			}
		>
			<SelectTrigger class="w-full bg-[var(--v2-surface)]">
				<SelectValue<unknown>>
					{(state) => {
						const selected = state.selectedOption();
						return selected &&
							typeof selected === "object" &&
							"name" in selected
							? (selected as { name: string }).name
							: "All sources";
					}}
				</SelectValue>
			</SelectTrigger>
			<SelectContent />
		</Select>
	);
}

function BatchToolPanel(props: {
	kind: "tagging" | "vectors";
	manager: UseManagerPageResult;
}) {
	const [pendingAction, setPendingAction] = createSignal<
		"scan" | "start" | null
	>(null);
	const isVector = () => props.kind === "vectors";
	const runScan = async () => {
		if (pendingAction()) return;
		setPendingAction("scan");
		try {
			await props.manager.handleScan();
		} finally {
			setPendingAction(null);
		}
	};
	const runStart = async () => {
		if (pendingAction()) return;
		setPendingAction("start");
		try {
			if (isVector()) {
				await props.manager.handleStartBatchCcipExtraction();
			} else {
				await props.manager.handleStartBatchTagging();
			}
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					{isVector() ? "Vector extraction" : "Batch tagging"}
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					{isVector()
						? "Create CCIP character embeddings for similarity search."
						: "Analyze media and submit AI tagging jobs."}
				</p>
			</div>

			<section
				aria-labelledby={`${props.kind}-options-title`}
				class="border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4"
			>
				<h3 class="sr-only" id={`${props.kind}-options-title`}>
					Job options
				</h3>
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="space-y-1.5">
						<Label>Target source</Label>
						<SourceSelect
							manager={props.manager}
							onChange={props.manager.setSelectedSourceId}
							value={props.manager.selectedSourceId()}
						/>
						<p class="text-xs text-[var(--v2-text-muted)]">
							Leave empty to process all sources.
						</p>
					</div>
					<div class="space-y-2">
						<Label>Existing results</Label>
						<Checkbox
							checked={props.manager.forceRetag()}
							class="flex min-h-9 items-center gap-2"
							onChange={props.manager.setForceRetag}
						>
							<CheckboxControl />
							<CheckboxLabel>
								{isVector() ? "Force re-extraction" : "Force re-tagging"}
							</CheckboxLabel>
						</Checkbox>
						<p class="text-xs text-[var(--v2-text-muted)]">
							When disabled, processed media is skipped.
						</p>
					</div>
				</div>
				<div class="mt-4 flex flex-col justify-end gap-2 border-[var(--v2-border)] border-t pt-4 sm:flex-row">
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void runScan()}
						variant="outline"
					>
						{pendingAction() === "scan" ? "Scanning..." : "Scan targets"}
					</Button>
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void runStart()}
					>
						{pendingAction() === "start"
							? "Submitting..."
							: isVector()
								? "Start extraction"
								: "Start tagging"}
					</Button>
				</div>
			</section>

			<Show when={props.manager.taggingStatus() || props.manager.jobProgress()}>
				<section
					aria-live="polite"
					class="space-y-3 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="font-medium text-sm">Current run</h3>
						<Badge variant="secondary">
							{props.manager.activeJobId() ? "Running" : "Status"}
						</Badge>
					</div>
					<p class="text-xs text-[var(--v2-text-secondary)]">
						{props.manager.taggingStatus()}
					</p>
					<Show when={props.manager.jobProgress()}>
						{(progress) => (
							<div class="space-y-2">
								<div class="flex justify-between text-xs text-[var(--v2-text-muted)]">
									<span>Progress</span>
									<span>
										{progress().processed} / {progress().total}
									</span>
								</div>
								<Progress
									class="h-2"
									value={
										progress().total > 0
											? (progress().processed / progress().total) * 100
											: 0
									}
								/>
							</div>
						)}
					</Show>
				</section>
			</Show>
		</div>
	);
}

function DuplicateToolPanel(props: { manager: UseManagerPageResult }) {
	const [isScanning, setIsScanning] = createSignal(false);
	const scan = async () => {
		if (isScanning()) return;
		setIsScanning(true);
		try {
			await props.manager.handleScanDuplicates();
		} finally {
			setIsScanning(false);
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					Duplicate detection
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					Find matching media and choose one item to keep in each group.
				</p>
			</div>

			<section class="border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4">
				<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div class="space-y-1.5">
						<Label>Target source</Label>
						<Select
							itemComponent={(selectProps) => (
								<SelectItem item={selectProps.item}>
									{selectProps.item.rawValue.name}
								</SelectItem>
							)}
							onChange={(value) =>
								props.manager.setDuplicateSourceId(
									value?.id === ALL_SOURCES_OPTION.id ? undefined : value?.id,
								)
							}
							options={[ALL_SOURCES_OPTION, ...props.manager.sources()]}
							optionTextValue="name"
							optionValue="id"
							value={
								props.manager.duplicateSourceId()
									? props.manager
											.sources()
											.find(
												(source) =>
													source.id === props.manager.duplicateSourceId(),
											)
									: ALL_SOURCES_OPTION
							}
						>
							<SelectTrigger class="w-full bg-[var(--v2-surface)]">
								<SelectValue<unknown>>
									{(state) => {
										const selected = state.selectedOption();
										return selected &&
											typeof selected === "object" &&
											"name" in selected
											? (selected as { name: string }).name
											: "All sources";
									}}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
					<Button
						class="w-full lg:w-auto"
						disabled={isScanning()}
						onClick={() => void scan()}
					>
						{isScanning() ? "Scanning..." : "Scan for duplicates"}
					</Button>
				</div>
				<Show when={props.manager.duplicateStatus()}>
					<p
						aria-live="polite"
						class="mt-3 text-xs text-[var(--v2-text-secondary)]"
					>
						{props.manager.duplicateStatus()}
					</p>
				</Show>
			</section>

			<Show when={props.manager.duplicateGroups().length > 0}>
				<div class="flex flex-col gap-3 border-[var(--v2-border)] border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
					<p class="font-medium text-sm">
						{props.manager.duplicateGroups().length} duplicate groups
					</p>
					<div class="grid grid-cols-2 gap-2 sm:flex">
						<Button
							onClick={props.manager.selectKeepOldest}
							size="sm"
							variant="outline"
						>
							Keep oldest
						</Button>
						<Button
							onClick={props.manager.selectKeepLargest}
							size="sm"
							variant="outline"
						>
							Keep largest
						</Button>
						<Button
							class="col-span-2 sm:col-auto"
							disabled={props.manager.deleteCount() === 0}
							onClick={props.manager.handleDeleteDuplicates}
							variant="destructive"
						>
							Delete {props.manager.deleteCount()}
						</Button>
					</div>
				</div>

				<div class="space-y-4">
					<For each={props.manager.duplicateGroups()}>
						{(group, index) => (
							<div class="overflow-x-auto rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] [scrollbar-gutter:stable]">
								<table class="w-full min-w-[42rem] border-collapse text-left text-xs">
									<caption class="px-3 py-2 text-left font-medium text-sm text-[var(--v2-text)]">
										Group {index() + 1} · {group.media.length} items
									</caption>
									<thead class="border-[var(--v2-border)] border-t bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]">
										<tr>
											<th class="px-3 py-2 font-medium" scope="col">
												Preview
											</th>
											<th class="px-3 py-2 font-medium" scope="col">
												File
											</th>
											<th class="px-3 py-2 font-medium" scope="col">
												Resolution
											</th>
											<th class="px-3 py-2 font-medium" scope="col">
												Size
											</th>
											<th class="px-3 py-2 font-medium" scope="col">
												Created
											</th>
											<th class="px-3 py-2 text-right font-medium" scope="col">
												Decision
											</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-[var(--v2-border)]">
										<For each={group.media}>
											{(item) => {
												const keep = () => props.manager.keepIds().has(item.id);
												const thumbnail = () =>
													`/api/sources/${item.mediaSourceId}/thumbnail/${item.id}?t=${new Date(item.modifiedAt).getTime()}`;
												return (
													<tr
														class={
															keep()
																? "bg-[var(--v2-surface-selected)]"
																: undefined
														}
													>
														<td class="px-3 py-2">
															<img
																alt=""
																class="h-10 w-14 rounded object-cover"
																loading="lazy"
																src={thumbnail()}
															/>
														</td>
														<th
															class="max-w-64 px-3 py-2 font-medium"
															scope="row"
														>
															<span
																class="block truncate"
																title={item.fileName}
															>
																{item.fileName}
															</span>
														</th>
														<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-secondary)]">
															{item.width} × {item.height}
														</td>
														<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-secondary)]">
															{formatBytes(item.fileSize)}
														</td>
														<td class="whitespace-nowrap px-3 py-2 text-[var(--v2-text-secondary)]">
															{formatDate(item.createdAt)}
														</td>
														<td class="px-3 py-2 text-right">
															<Button
																aria-label={`${item.fileName}を保持`}
																aria-pressed={keep()}
																onClick={() =>
																	props.manager.setKeepForGroup(
																		group.id,
																		item.id,
																	)
																}
																size="sm"
																variant={keep() ? "default" : "outline"}
															>
																{keep() ? "Keep" : "Keep this"}
															</Button>
														</td>
													</tr>
												);
											}}
										</For>
									</tbody>
								</table>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

function DataTransferPanel(props: {
	actions: V2ManagerTransferActions;
	manager: UseManagerPageResult;
}) {
	const [sourceId, setSourceId] = createSignal<string>();
	const [exportFormat, setExportFormat] =
		createSignal<V2ManagerTransferFormat>("ndjson");
	const [importFormat, setImportFormat] =
		createSignal<V2ManagerTransferFormat>("ndjson");
	const [includeImages, setIncludeImages] = createSignal(false);
	const [pending, setPending] = createSignal<"export" | "import" | null>(null);
	let fileInput: HTMLInputElement | undefined;

	const selectedSource = () =>
		props.manager.sources().find((source) => source.id === sourceId());
	const accept = () => {
		switch (importFormat()) {
			case "ndjson":
				return ".ndjson,application/x-ndjson";
			case "tar":
				return ".tar,.zip,application/x-tar,application/zip";
			case "lancedb":
				return ".tar,application/x-tar";
		}
	};
	const runExport = async () => {
		const selectedId = sourceId();
		if (!selectedId || pending()) return;
		setPending("export");
		try {
			await props.actions.exportSource({
				format: exportFormat(),
				includeImages: includeImages(),
				sourceId: selectedId,
			});
		} finally {
			setPending(null);
		}
	};
	const importFile = async (file: File) => {
		const selectedId = sourceId();
		if (!selectedId || pending()) return;
		setPending("import");
		try {
			await props.actions.importSource({
				file,
				format: importFormat(),
				sourceId: selectedId,
			});
		} finally {
			setPending(null);
			if (fileInput) fileInput.value = "";
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					Data transfer
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					Export a portable source dump or restore one into an existing source.
				</p>
			</div>

			<section class="space-y-1.5 border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4">
				<Label>Target source</Label>
				<Select
					itemComponent={(selectProps) => (
						<SelectItem item={selectProps.item}>
							{selectProps.item.rawValue.name}
						</SelectItem>
					)}
					onChange={(source) => setSourceId(source?.id)}
					options={props.manager.sources()}
					optionTextValue="name"
					optionValue="id"
					placeholder="Choose a source"
					value={selectedSource() ?? null}
				>
					<SelectTrigger class="w-full bg-[var(--v2-surface)] sm:max-w-xl">
						<SelectValue<unknown>>
							{() => selectedSource()?.name ?? "Choose a source"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<p class="text-xs text-[var(--v2-text-muted)]">
					Restore writes into the selected source. Existing source configuration
					is not replaced.
				</p>
			</section>

			<div class="grid gap-4 xl:grid-cols-2">
				<section class="rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-[var(--v2-surface-muted)] p-2 text-[var(--v2-primary)]">
							<Download aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-[var(--v2-text)]">Export</h3>
							<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
								Download metadata, media archive, or LanceDB data.
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Label>Format</Label>
							<Select
								onChange={(value) => value && setExportFormat(value)}
								options={["ndjson", "tar", "lancedb"] as const}
								value={exportFormat()}
							>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? "NDJSON metadata"
												: state.selectedOption() === "tar"
													? "TAR archive"
													: "LanceDB TAR"
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Show when={exportFormat() === "lancedb"}>
							<Checkbox
								checked={includeImages()}
								class="flex min-h-9 items-center gap-2"
								onChange={setIncludeImages}
							>
								<CheckboxControl />
								<CheckboxLabel>Include original media</CheckboxLabel>
							</Checkbox>
						</Show>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => void runExport()}
						>
							{pending() === "export" ? "Preparing..." : "Download dump"}
						</Button>
					</div>
				</section>

				<section class="rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-[var(--v2-surface-muted)] p-2 text-[var(--v2-primary)]">
							<Upload aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-[var(--v2-text)]">Restore</h3>
							<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
								Choose the dump type before selecting its file.
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Label>Format</Label>
							<Select
								onChange={(value) => value && setImportFormat(value)}
								options={["ndjson", "tar", "lancedb"] as const}
								value={importFormat()}
							>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? "NDJSON metadata"
												: state.selectedOption() === "tar"
													? "TAR archive"
													: "LanceDB TAR"
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Input
							accept={accept()}
							aria-label="復元するダンプファイル"
							class="sr-only"
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) void importFile(file);
							}}
							ref={fileInput}
							type="file"
						/>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => fileInput?.click()}
							variant="outline"
						>
							{pending() === "import" ? "Restoring..." : "Choose dump file"}
						</Button>
					</div>
				</section>
			</div>
			<p class="text-xs text-[var(--v2-text-muted)]">
				Exports and restores run immediately. Job history and cancellation are
				not yet available for these operations.
			</p>
		</div>
	);
}

function entityFormIsDirty(manager: UseManagerPageResult): boolean {
	const form = manager.formData();
	const editing = manager.editingItem();
	if (!editing) {
		return (
			form.name.trim().length > 0 ||
			form.description.trim().length > 0 ||
			(form.ipIds?.length ?? 0) > 0
		);
	}
	const originalIpIds = isCharacter(editing)
		? editing.ips.map((ip) => ip.id).sort()
		: [];
	const currentIpIds = [...(form.ipIds ?? [])].sort();
	return (
		form.name !== editing.name ||
		form.description !== (editing.description ?? "") ||
		originalIpIds.join("|") !== currentIpIds.join("|")
	);
}

function ManagerDialogs(props: { manager: UseManagerPageResult }) {
	const [discardDialogOpen, setDiscardDialogOpen] = createSignal(false);
	const requestFormClose = () => {
		if (entityFormIsDirty(props.manager)) {
			setDiscardDialogOpen(true);
			return;
		}
		props.manager.setIsDialogOpen(false);
	};
	const handleFormOpenChange = (open: boolean) => {
		if (open) {
			props.manager.setIsDialogOpen(true);
			return;
		}
		requestFormClose();
	};

	return (
		<>
			<Dialog
				onOpenChange={handleFormOpenChange}
				open={props.manager.isDialogOpen()}
			>
				<DialogContent
					onEscapeKeyDown={(event) => {
						if (!entityFormIsDirty(props.manager)) return;
						event.preventDefault();
						setDiscardDialogOpen(true);
					}}
					onPointerDownOutside={(event) => {
						if (!entityFormIsDirty(props.manager)) return;
						event.preventDefault();
						setDiscardDialogOpen(true);
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{props.manager.editingItem() ? "Edit" : "Create"}{" "}
							{singularLabel(props.manager.activeTab())}
						</DialogTitle>
						<DialogDescription>
							{props.manager.editingItem()
								? "Update this item without leaving the Manager context."
								: "Add a new item to the current category."}
						</DialogDescription>
					</DialogHeader>
					<div class="grid gap-4 py-2">
						<div class="space-y-1.5">
							<Label for="v2-manager-entity-name">Name</Label>
							<Input
								id="v2-manager-entity-name"
								onInput={(event) =>
									props.manager.setFormData({
										...props.manager.formData(),
										name: event.currentTarget.value,
									})
								}
								value={props.manager.formData().name}
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="v2-manager-entity-description">Description</Label>
							<Input
								id="v2-manager-entity-description"
								onInput={(event) =>
									props.manager.setFormData({
										...props.manager.formData(),
										description: event.currentTarget.value,
									})
								}
								value={props.manager.formData().description}
							/>
						</div>
						<Show when={props.manager.activeTab() === "characters"}>
							<div class="space-y-1.5">
								<Label for="v2-manager-entity-ips">IPs</Label>
								<Combobox<Ip>
									itemComponent={(comboboxProps) => (
										<ComboboxItem item={comboboxProps.item}>
											<ComboboxItemLabel>
												{comboboxProps.item.rawValue.name}
											</ComboboxItemLabel>
											<ComboboxItemIndicator />
										</ComboboxItem>
									)}
									multiple
									onChange={(values) =>
										props.manager.setFormData({
											...props.manager.formData(),
											ipIds: values.map((value) => value.id),
										})
									}
									optionLabel="name"
									options={props.manager.ips()}
									optionTextValue="name"
									optionValue="id"
									value={props.manager
										.ips()
										.filter((ip) =>
											props.manager.formData().ipIds?.includes(ip.id),
										)}
								>
									<ComboboxControl>
										<ComboboxInput
											id="v2-manager-entity-ips"
											placeholder="Select IPs..."
										/>
										<ComboboxTrigger />
									</ComboboxControl>
									<ComboboxContent />
								</Combobox>
							</div>
						</Show>
					</div>
					<DialogFooter>
						<Button onClick={requestFormClose} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={!props.manager.formData().name.trim()}
							onClick={props.manager.handleSave}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={setDiscardDialogOpen}
				open={discardDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							The changes in this form have not been saved.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setDiscardDialogOpen(false);
								props.manager.setIsDialogOpen(false);
							}}
						>
							Discard
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={props.manager.setIsDeleteDialogOpen}
				open={props.manager.isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this item?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes{" "}
							{props.manager.itemToDelete()?.name ?? "the item"}.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={props.manager.handleConfirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={props.manager.setIsDuplicateDeleteDialogOpen}
				open={props.manager.isDuplicateDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete duplicate media?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes{" "}
							{props.manager.duplicatesToDelete().length} media items.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div class="max-h-48 overflow-y-auto overscroll-contain text-sm">
						<For each={props.manager.duplicatesToDelete()}>
							{(item) => (
								<div class="truncate border-[var(--v2-border)] border-b py-1 text-[var(--v2-text-secondary)]">
									{item.fileName}
								</div>
							)}
						</For>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={props.manager.handleConfirmDeleteDuplicates}
						>
							Delete {props.manager.duplicatesToDelete().length}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function V2ManagerScreen(props: {
	manager: UseManagerPageResult;
	transferActions?: V2ManagerTransferActions;
}) {
	const [query, setQuery] = createSignal("");
	const [selectedId, setSelectedId] = createSignal<string | null>(null);
	const [activeCategory, setActiveCategory] =
		createSignal<V2ManagerCategory>("projects");
	const activeQueryState = () => {
		const states = props.manager.queryStates();
		switch (activeCategory()) {
			case "projects":
				return states.projects;
			case "ips":
				return states.ips;
			case "characters":
				return states.characters;
			default:
				return states.sources;
		}
	};
	const canRenderContent = () =>
		activeQueryState().phase === "data" ||
		(activeQueryState().phase === "empty" && !isCrudCategory(activeCategory()));
	const changeCategory = (value: V2ManagerCategory) => {
		setQuery("");
		setSelectedId(null);
		setActiveCategory(value);
		if (value !== "transfer") props.manager.setActiveTab(value);
	};

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2ManagementHeader
				description="分類データの管理とバッチ処理の投入を行います。"
				title="Manager"
			/>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
				<ManagerCategoryNavigation
					active={activeCategory()}
					compact
					onChange={changeCategory}
				/>
				<div class="grid w-full gap-6 px-3 py-4 sm:px-4 lg:grid-cols-[12rem_minmax(0,1fr)] lg:px-6 lg:py-5 xl:gap-8 xl:px-8">
					<ManagerCategoryNavigation
						active={activeCategory()}
						onChange={changeCategory}
					/>

					<div class="min-w-0">
						<QueryStatus
							class="mb-3"
							fetchState={activeQueryState().fetchState}
							hasData={activeQueryState().data !== undefined}
							hideWhenIdle
							offlineLabel="オフラインのため保存済みの管理データを表示しています。"
							updatingLabel="管理データを更新中..."
						/>

						<Switch>
							<Match when={activeQueryState().phase === "pending"}>
								<ManagerTableSkeleton />
							</Match>
							<Match when={activeQueryState().phase === "error"}>
								<ErrorState
									description="接続を確認して、もう一度お試しください。"
									onRetry={props.manager.retryQueries}
									title="管理データを取得できませんでした"
								/>
							</Match>
							<Match when={activeQueryState().phase === "offline"}>
								<OfflineState
									description="接続が戻ったら、この画面から再試行できます。"
									onRetry={props.manager.retryQueries}
								/>
							</Match>
						</Switch>

						<Show
							when={
								activeQueryState().phase === "empty" &&
								isCrudCategory(activeCategory())
							}
						>
							<EmptyState
								description="最初の項目を作成すると、ここに表示されます。"
								title={`${categoryLabel(activeCategory())}はまだありません`}
							>
								<Button onClick={props.manager.openCreateDialog}>
									New {singularLabel(props.manager.activeTab())}
								</Button>
							</EmptyState>
						</Show>

						<Show when={canRenderContent()}>
							<Switch>
								<Match when={isCrudCategory(activeCategory())}>
									<Show
										when={
											props.manager.activeTab() !== "characters" ||
											(props.manager.queryStates().ips.phase !== "error" &&
												props.manager.queryStates().ips.phase !== "offline")
										}
									>
										<EntityTablePanel
											manager={props.manager}
											onQueryChange={setQuery}
											onSelect={setSelectedId}
											query={query()}
											selectedId={selectedId()}
										/>
									</Show>
									<Show
										when={
											props.manager.activeTab() === "characters" &&
											(props.manager.queryStates().ips.phase === "error" ||
												props.manager.queryStates().ips.phase === "offline")
										}
									>
										<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-foreground/30 bg-warning/40 p-3">
											<p class="text-xs text-[var(--v2-text-secondary)]">
												IP候補を取得できませんでした。Characters一覧は引き続き利用できます。
											</p>
											<RetryButton
												class="h-8 px-3 text-xs"
												label="IP候補を再取得"
												onRetry={props.manager.retryQueries}
											/>
										</div>
										<EntityTablePanel
											manager={props.manager}
											onQueryChange={setQuery}
											onSelect={setSelectedId}
											query={query()}
											selectedId={selectedId()}
										/>
									</Show>
								</Match>
								<Match when={activeCategory() === "tagging"}>
									<BatchToolPanel kind="tagging" manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "vectors"}>
									<BatchToolPanel kind="vectors" manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "duplicates"}>
									<DuplicateToolPanel manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "transfer"}>
									<Show
										fallback={
											<ErrorState
												description="Data transfer actions are not configured for this client."
												title="Data transfer is unavailable"
											/>
										}
										when={props.transferActions}
									>
										{(actions) => (
											<DataTransferPanel
												actions={actions()}
												manager={props.manager}
											/>
										)}
									</Show>
								</Match>
							</Switch>
						</Show>
					</div>
				</div>
			</div>

			<ManagerDialogs manager={props.manager} />
		</section>
	);
}

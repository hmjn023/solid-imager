import { createMemo, For, Show } from "solid-js";
import { EmptyState } from "../../async-state";
import { Button } from "../../button";
import type {
	ManagerEntity,
	UseManagerPageResult,
} from "../../hooks/use-manager-page";
import { Pencil, Plus, Search, Trash2 } from "../../icons";
import { Input } from "../../input";
import { LoadingRegion } from "../../skeleton";
import {
	categoryLabel,
	formatDate,
	isCharacter,
	isIp,
	singularLabel,
} from "./utils";

export function ManagerTableSkeleton() {
	return (
		<LoadingRegion label="管理データを読み込んでいます...">
			<div class="overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]">
				<div class="h-9 animate-pulse bg-[var(--app-surface-muted)] motion-reduce:animate-none" />
				<For each={[1, 2, 3, 4, 5]}>
					{() => (
						<div class="grid h-14 grid-cols-[2fr_3fr_1fr] gap-4 border-[var(--app-border)] border-t px-4 py-3">
							<span class="rounded bg-[var(--app-surface-muted)]" />
							<span class="rounded bg-[var(--app-surface-muted)]" />
							<span class="rounded bg-[var(--app-surface-muted)]" />
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
			class="hidden self-start rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-4 2xl:block"
		>
			<p class="text-xs text-[var(--app-text-muted)]">
				Selected {singularLabel(active())}
			</p>
			<h3 class="mt-1 break-words font-semibold text-base text-[var(--app-text)]">
				{props.item.name}
			</h3>
			<p class="mt-2 text-xs leading-5 text-[var(--app-text-secondary)]">
				{props.item.description || "No description"}
			</p>
			<dl class="mt-4 space-y-3 border-[var(--app-border)] border-y py-4 text-xs">
				<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
					<dt class="text-[var(--app-text-muted)]">ID</dt>
					<dd class="break-all text-[var(--app-text)]">{props.item.id}</dd>
				</div>
				<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
					<dt class="text-[var(--app-text-muted)]">Updated</dt>
					<dd class="text-[var(--app-text)]">
						{formatDate(props.item.updatedAt)}
					</dd>
				</div>
				<Show when={isCharacter(props.item) || isIp(props.item)}>
					<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
						<dt class="text-[var(--app-text-muted)]">
							{isCharacter(props.item) ? "IPs" : "Source"}
						</dt>
						<dd class="break-words text-[var(--app-text)]">
							{relationSummary(props.item)}
						</dd>
					</div>
				</Show>
				<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
					<dt class="text-[var(--app-text-muted)]">Media</dt>
					<dd class="text-[var(--app-text)]">
						{props.item.mediaCount?.toLocaleString() ?? "—"}
					</dd>
				</div>
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

export function EntityTablePanel(props: {
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
					<h2 class="font-semibold text-lg text-[var(--app-text)]">
						{categoryLabel(active())}
					</h2>
					<p class="mt-0.5 text-xs text-[var(--app-text-muted)]">
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
							class="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--app-text-muted)]"
							size={15}
						/>
						<Input
							aria-label={`${categoryLabel(active())}を検索`}
							class="h-9 bg-[var(--app-surface)] pl-9 shadow-none"
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
						<div class="overflow-x-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] [scrollbar-gutter:stable]">
							<table class="w-full min-w-[46rem] border-collapse text-left text-sm">
								<caption class="sr-only">
									{categoryLabel(active())}の一覧。{items().length}件。
								</caption>
								<thead class="bg-[var(--app-surface-muted)] text-xs text-[var(--app-text-muted)]">
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
											Media
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											Updated
										</th>
										<th class="px-3 py-2 text-right font-medium" scope="col">
											Actions
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-[var(--app-border)]">
									<For each={items()}>
										{(item) => {
											const selected = () => selectedItem()?.id === item.id;
											return (
												<tr
													class={
														selected()
															? "bg-[var(--app-surface-selected)]"
															: "hover:bg-[var(--app-surface-muted)]"
													}
												>
													<th class="p-0 font-normal" scope="row">
														<button
															aria-pressed={selected()}
															class="block min-h-12 w-full px-3 py-2 text-left font-medium text-[var(--app-text)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus)]"
															onClick={() => props.onSelect(item.id)}
															type="button"
														>
															<span class="block max-w-52 truncate">
																{item.name}
															</span>
														</button>
													</th>
													<td class="max-w-[28rem] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
														<span class="line-clamp-2">
															{item.description || "No description"}
														</span>
													</td>
													<td class="max-w-52 px-3 py-2 text-xs text-[var(--app-text-secondary)]">
														<span class="block truncate">
															{active() === "projects"
																? "Active"
																: relationSummary(item)}
														</span>
													</td>
													<td class="whitespace-nowrap px-3 py-2 text-xs text-[var(--app-text-secondary)]">
														{item.mediaCount?.toLocaleString() ?? "—"}
													</td>
													<td class="whitespace-nowrap px-3 py-2 text-xs text-[var(--app-text-muted)]">
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
							class="mt-2 text-xs text-[var(--app-text-muted)]"
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

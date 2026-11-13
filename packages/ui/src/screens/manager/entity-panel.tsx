import { t } from "@solid-imager/i18n";
import Pencil from "lucide-solid/icons/pencil";
import Plus from "lucide-solid/icons/plus";
import Search from "lucide-solid/icons/search";
import Trash2 from "lucide-solid/icons/trash";
import { createMemo, For, Show } from "solid-js";
import { EmptyState } from "../../async-state";
import { Button } from "../../button";
import type {
	ManagerEntity,
	UseManagerPageResult,
} from "../../hooks/use-manager-page";
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
		<LoadingRegion label={t("entityPanel.loadingManagementData")}>
			<div class="overflow-hidden rounded-md border border-border bg-card">
				<div class="h-9 animate-pulse bg-muted motion-reduce:animate-none" />
				<For each={[1, 2, 3, 4, 5]}>
					{() => (
						<div class="grid h-14 grid-cols-entity-summary gap-4 border-border border-t px-4 py-3">
							<span class="rounded bg-muted" />
							<span class="rounded bg-muted" />
							<span class="rounded bg-muted" />
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
			aria-label={t("entityPanel.selectedItem")}
			class="hidden self-start rounded-md border border-border bg-card p-4 2xl:block"
		>
			<p class="text-xs text-muted-foreground">
				{t("entityPanel.selectedValue", {
					value0: String(singularLabel(active())),
				})}
			</p>
			<h3 class="mt-1 break-words font-semibold text-base text-foreground">
				{props.item.name}
			</h3>
			<p class="mt-2 text-xs leading-5 text-muted-foreground">
				{props.item.description || t("labels.noDescription")}
			</p>
			<dl class="mt-4 space-y-3 border-border border-y py-4 text-xs">
				<div class="grid grid-cols-label-field gap-3">
					<dt class="text-muted-foreground">{t("entityPanel.iD")}</dt>
					<dd class="break-all text-foreground">{props.item.id}</dd>
				</div>
				<div class="grid grid-cols-label-field gap-3">
					<dt class="text-muted-foreground">{t("jobsScreen.updated")}</dt>
					<dd class="text-foreground">{formatDate(props.item.updatedAt)}</dd>
				</div>
				<Show when={isCharacter(props.item) || isIp(props.item)}>
					<div class="grid grid-cols-label-field gap-3">
						<dt class="text-muted-foreground">
							{isCharacter(props.item) ? t("labels.ips") : t("labels.source")}
						</dt>
						<dd class="break-words text-foreground">
							{relationSummary(props.item)}
						</dd>
					</div>
				</Show>
				<div class="grid grid-cols-label-field gap-3">
					<dt class="text-muted-foreground">{t("configScreen.media")}</dt>
					<dd class="text-foreground">
						{props.item.mediaCount?.toLocaleString() ?? "—"}
					</dd>
				</div>
			</dl>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<Button
					aria-label={t("entityPanel.editValue", {
						value0: String(props.item.name),
					})}
					onClick={() => props.manager.openEditDialog(props.item)}
					variant="outline"
				>
					<Pencil aria-hidden="true" size={14} />
					{t("actions.edit")}
				</Button>
				<Button
					aria-label={t("entityPanel.deleteValue", {
						value0: String(props.item.name),
					})}
					class="text-destructive"
					onClick={() => {
						props.manager.setItemToDelete(props.item);
						props.manager.setIsDeleteDialogOpen(true);
					}}
					variant="outline"
				>
					<Trash2 aria-hidden="true" size={14} />
					{t("actions.delete")}
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
					<h2 class="font-semibold text-lg text-foreground">
						{categoryLabel(active())}
					</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{t("entityPanel.createReviewAndMaintainValue", {
							value0: String(categoryLabel(active()).toLowerCase()),
						})}
					</p>
				</div>
				<Button
					class="w-full sm:w-auto"
					onClick={props.manager.openCreateDialog}
				>
					<Plus aria-hidden="true" size={15} />
					{t("entityPanel.newValue", { value0: singularLabel(active()) })}
				</Button>
			</div>

			<div class="grid min-w-0 gap-4 2xl:grid-cols-manager-sidebar">
				<div class="min-w-0">
					<div class="relative mb-3">
						<Search
							aria-hidden="true"
							class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							size={15}
						/>
						<Input
							aria-label={t("relationsEditor.searchValue", {
								value0: String(categoryLabel(active())),
							})}
							class="h-9 bg-card pl-9 shadow-none"
							onInput={(event) =>
								props.onQueryChange(event.currentTarget.value)
							}
							placeholder={t("relationsEditor.searchValue2", {
								value0: String(categoryLabel(active()).toLowerCase()),
							})}
							value={props.query}
						/>
					</div>

					<Show
						fallback={
							<EmptyState
								class="min-h-52"
								description={t(
									"entityPanel.changeYourSearchConditionsOrCreateANewItem",
								)}
								title={t("entityPanel.noValueFound", {
									value0: String(categoryLabel(active())),
								})}
							>
								<Button onClick={props.manager.openCreateDialog}>
									{t("entityPanel.newValue", {
										value0: String(singularLabel(active())),
									})}
								</Button>
							</EmptyState>
						}
						when={items().length > 0}
					>
						<div class="overflow-x-auto rounded-md border border-border bg-card scrollbar-stable">
							<table class="w-full min-w-table-standard border-collapse text-left text-sm">
								<caption class="sr-only">
									{t("entityPanel.valueListValueItems", {
										value0: String(categoryLabel(active())),
										value1: String(items().length),
									})}
								</caption>
								<thead class="bg-muted text-xs text-muted-foreground">
									<tr>
										<th class="px-3 py-2 font-medium" scope="col">
											{t("labels.name")}
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											{t("labels.description")}
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											{active() === "characters"
												? t("labels.ips")
												: active() === "ips"
													? t("labels.source")
													: t("jobsScreen.status")}
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											{t("configScreen.media")}
										</th>
										<th class="px-3 py-2 font-medium" scope="col">
											{t("jobsScreen.updated")}
										</th>
										<th class="px-3 py-2 text-right font-medium" scope="col">
											{t("entityPanel.actions")}
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border">
									<For each={items()}>
										{(item) => {
											const selected = () => selectedItem()?.id === item.id;
											return (
												<tr class={selected() ? "bg-accent" : "hover:bg-muted"}>
													<th class="p-0 font-normal" scope="row">
														<button
															aria-label={item.name}
															aria-pressed={selected()}
															class="block min-h-12 w-full px-3 py-2 text-left font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
															onClick={() => props.onSelect(item.id)}
															type="button"
														>
															<span class="block max-w-52 truncate">
																{item.name}
															</span>
														</button>
													</th>
													<td class="max-w-dialog-reading px-3 py-2 text-xs text-muted-foreground">
														<span class="line-clamp-2">
															{item.description || t("labels.noDescription")}
														</span>
													</td>
													<td class="max-w-52 px-3 py-2 text-xs text-muted-foreground">
														<span class="block truncate">
															{active() === "projects"
																? t("jobsScreen.active")
																: relationSummary(item)}
														</span>
													</td>
													<td class="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
														{item.mediaCount?.toLocaleString() ?? "—"}
													</td>
													<td class="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
														{formatDate(item.updatedAt)}
													</td>
													<td class="px-3 py-2">
														<div class="flex justify-end gap-1">
															<Button
																aria-label={t("entityPanel.editValue", {
																	value0: String(item.name),
																})}
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
																aria-label={t("entityPanel.deleteValue", {
																	value0: String(item.name),
																})}
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
						<p class="mt-2 text-xs text-muted-foreground" aria-live="polite">
							{t("charts.valueItems", {
								value0: String(items().length),
							})}
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

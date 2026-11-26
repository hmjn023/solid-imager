import { mediaThumbnailPath } from "@solid-imager/core/http";
import type { DuplicateGroup } from "@solid-imager/core/media";
import { t } from "@solid-imager/i18n";
import ExternalLink from "lucide-solid/icons/external-link";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "../../badge";
import { Button } from "../../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { ManagedThumbnailImage } from "../../managed-thumbnail-image";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../table";
import type { DuplicateToolActions } from "./types";
import { formatBytes, formatDate } from "./utils";
import { SourceSelect } from "./source-select";

type PreviewState = {
	groupId: string;
	item: DuplicateGroup["media"][number];
};

export function DuplicateToolPanel(props: {
	manager: UseManagerPageResult;
	actions?: DuplicateToolActions;
}) {
	const isScanning = () => props.manager.isScanningDuplicates();
	const [preview, setPreview] = createSignal<PreviewState | null>(null);
	const showSourceColumn = () => !props.manager.duplicateSourceId();
	const sourceLabel = (sourceId: string) =>
		props.manager.sources().find((source) => source.id === sourceId)?.name ??
		sourceId;
	const resolveThumbnail = (item: DuplicateGroup["media"][number]) =>
		props.actions?.thumbnailUrl
			? props.actions.thumbnailUrl(item)
			: mediaThumbnailPath(item.mediaSourceId, item.id, {
					cacheKey: new Date(item.modifiedAt).getTime(),
				});

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-foreground">
					{t("duplicates.duplicateDetection")}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{t("duplicates.findMatchingMediaAndChooseOneItemToKeep")}
				</p>
			</div>

			<section class="border-border border-y bg-card py-4 sm:rounded-md sm:border sm:p-4">
				<div class="grid gap-4 lg:grid-cols-content-action lg:items-end">
					<SourceSelect
						allowAll
						sources={props.manager.sources()}
						onChange={props.manager.setDuplicateSourceId}
						value={props.manager.duplicateSourceId()}
					/>
					<Button
						class="min-h-11 w-full sm:min-h-9 lg:w-auto"
						disabled={isScanning() || props.manager.isDeletingDuplicates()}
						onClick={() => void props.manager.handleScanDuplicates()}
					>
						{isScanning()
							? t("duplicates.scanning")
							: t("duplicates.scanForDuplicates")}
					</Button>
				</div>
				<Show when={props.manager.duplicateStatus()}>
					<p aria-live="polite" class="mt-3 text-xs text-muted-foreground">
						{props.manager.duplicateStatus()}
					</p>
				</Show>
			</section>

			<Show when={props.manager.duplicateGroups().length > 0}>
				<div class="flex flex-col gap-3 border-border border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
					<p class="font-medium text-sm">
						{t("duplicates.valueDuplicateGroups", {
							value0: String(props.manager.duplicateGroups().length),
						})}
					</p>
					<div class="grid grid-cols-2 gap-2 sm:flex">
						<Button
							class="min-h-11 sm:min-h-9"
							disabled={props.manager.isDeletingDuplicates()}
							onClick={props.manager.selectKeepOldest}
							size="sm"
							variant="outline"
						>
							{t("duplicates.keepOldest")}
						</Button>
						<Button
							class="min-h-11 sm:min-h-9"
							disabled={props.manager.isDeletingDuplicates()}
							onClick={props.manager.selectKeepLargest}
							size="sm"
							variant="outline"
						>
							{t("duplicates.keepLargest")}
						</Button>
						<Button
							class="col-span-2 min-h-11 sm:col-auto sm:min-h-9"
							disabled={
								props.manager.deleteCount() === 0 ||
								props.manager.isDeletingDuplicates()
							}
							onClick={() => {
								void props.manager.handleDeleteDuplicates();
							}}
							variant="destructive"
						>
							{t("duplicates.deleteValue", {
								value0: String(props.manager.deleteCount()),
							})}
						</Button>
					</div>
				</div>

				<div class="space-y-4">
					<For each={props.manager.duplicateGroups()}>
						{(group, index) => {
							const skipped = () => props.manager.isGroupSkipped(group.id);
							return (
								<div class="overflow-hidden rounded-md border border-border bg-card">
									<div class="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-muted/40 px-3 py-2">
										<div class="flex flex-wrap items-center gap-2">
											<h3 class="font-medium text-sm text-foreground">
												{t("duplicates.groupValueValueItems", {
													value0: String(index() + 1),
													value1: String(group.media.length),
												})}
											</h3>
											<Show when={skipped()}>
												<Badge variant="secondary">
													{t("duplicates.skippedBadge")}
												</Badge>
											</Show>
										</div>
										<Button
											aria-pressed={skipped()}
											class="min-h-11 sm:min-h-9"
											disabled={
												props.manager.isDeletingDuplicates() || skipped()
											}
											onClick={() => props.manager.keepAllForGroup(group.id)}
											size="sm"
											variant={skipped() ? "secondary" : "outline"}
										>
											{t("duplicates.keepAll")}
										</Button>
									</div>
									<Table class="min-w-table-compact border-collapse caption-top text-left text-xs">
										<TableCaption class="sr-only">
											{t("duplicates.groupValueValueItems", {
												value0: String(index() + 1),
												value1: String(group.media.length),
											})}
										</TableCaption>
										<TableHeader class="bg-muted text-muted-foreground">
											<TableRow class="hover:bg-transparent">
												<TableHead
													class="h-auto px-3 py-2 font-medium"
													scope="col"
												>
													{t("duplicates.preview")}
												</TableHead>
												<TableHead
													class="h-auto px-3 py-2 font-medium"
													scope="col"
												>
													{t("duplicates.file")}
												</TableHead>
												<Show when={showSourceColumn()}>
													<TableHead
														class="h-auto px-3 py-2 font-medium"
														scope="col"
													>
														{t("labels.source")}
													</TableHead>
												</Show>
												<TableHead
													class="h-auto px-3 py-2 font-medium"
													scope="col"
												>
													{t("collectionInspector.resolution")}
												</TableHead>
												<TableHead
													class="h-auto px-3 py-2 font-medium"
													scope="col"
												>
													{t("collectionInspector.size")}
												</TableHead>
												<TableHead
													class="h-auto px-3 py-2 font-medium"
													scope="col"
												>
													{t("jobsScreen.created")}
												</TableHead>
												<TableHead
													class="h-auto px-3 py-2 text-right font-medium"
													scope="col"
												>
													{t("duplicates.decision")}
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody class="divide-y divide-border">
											<For each={group.media}>
												{(item) => {
													const keep = () =>
														props.manager.keepIds().has(item.id);
													const thumbnail = () => resolveThumbnail(item);
													return (
														<TableRow
															class={
																!skipped() && keep()
																	? "bg-accent hover:bg-accent"
																	: undefined
															}
														>
															<TableCell class="px-3 py-2">
																<button
																	aria-label={t("duplicates.previewValue", {
																		value0: String(item.fileName),
																	})}
																	class="block min-h-11 min-w-11 overflow-hidden rounded border border-border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
																	onClick={() =>
																		setPreview({ groupId: group.id, item })
																	}
																	type="button"
																>
																	<ManagedThumbnailImage
																		alt={t("duplicates.thumbnailForValue", {
																			value0: String(item.fileName),
																		})}
																		class="h-10 w-14 rounded object-cover"
																		loading="lazy"
																		releaseUrl={
																			props.actions?.releaseThumbnailUrl
																		}
																		src={thumbnail()}
																	/>
																</button>
															</TableCell>
															<TableHead
																class="h-auto max-w-64 px-3 py-2 font-medium text-foreground"
																scope="row"
															>
																<span
																	class="block truncate"
																	title={item.fileName}
																>
																	{item.fileName}
																</span>
															</TableHead>
															<Show when={showSourceColumn()}>
																<TableCell
																	class="max-w-40 truncate px-3 py-2 text-muted-foreground"
																	title={sourceLabel(item.mediaSourceId)}
																>
																	{sourceLabel(item.mediaSourceId)}
																</TableCell>
															</Show>
															<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
																{item.width} × {item.height}
															</TableCell>
															<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
																{formatBytes(item.fileSize)}
															</TableCell>
															<TableCell class="whitespace-nowrap px-3 py-2 text-muted-foreground">
																{formatDate(item.createdAt)}
															</TableCell>
															<TableCell class="px-3 py-2 text-right">
																<div class="flex items-center justify-end gap-2">
																	<Show when={props.actions?.openMedia}>
																		{(openMedia) => (
																			<Button
																				aria-label={t(
																					"duplicates.openDetailValue",
																					{ value0: String(item.fileName) },
																				)}
																				class="min-h-11 sm:min-h-9"
																				onClick={() =>
																					openMedia()(
																						item.mediaSourceId,
																						item.id,
																					)
																				}
																				size="sm"
																				type="button"
																				variant="ghost"
																			>
																				<ExternalLink class="size-3.5" />
																				<span class="sr-only sm:not-sr-only">
																					{t("duplicates.openDetail")}
																				</span>
																			</Button>
																		)}
																	</Show>
																	<Button
																		aria-label={t("duplicates.keepValue", {
																			value0: String(item.fileName),
																		})}
																		aria-pressed={!skipped() && keep()}
																		class="min-h-11 sm:min-h-9"
																		disabled={props.manager.isDeletingDuplicates()}
																		onClick={() =>
																			props.manager.setKeepForGroup(
																				group.id,
																				item.id,
																			)
																		}
																		size="sm"
																		type="button"
																		variant={
																			!skipped() && keep()
																				? "default"
																				: "outline"
																		}
																	>
																		{skipped()
																			? t("duplicates.keepOnlyThis")
																			: keep()
																				? t("duplicates.keep")
																				: t("duplicates.keepThis")}
																	</Button>
																</div>
															</TableCell>
														</TableRow>
													);
												}}
											</For>
										</TableBody>
									</Table>
								</div>
							);
						}}
					</For>
				</div>
			</Show>

			<Dialog
				open={Boolean(preview())}
				onOpenChange={(open) => {
					if (!open) setPreview(null);
				}}
			>
				<DialogContent class="workspace-theme rounded-lg sm:max-w-lg">
					<Show when={preview()}>
						{(current) => {
							const item = () => current().item;
							const groupId = () => current().groupId;
							const isKept = () =>
								!props.manager.isGroupSkipped(groupId()) &&
								props.manager.keepIds().has(item().id);
							return (
								<>
									<DialogHeader>
										<DialogTitle>{t("duplicates.previewTitle")}</DialogTitle>
										<DialogDescription class="break-all">
											{item().fileName}
										</DialogDescription>
									</DialogHeader>
									<div class="flex max-h-80 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 p-2">
										<ManagedThumbnailImage
											alt={item().fileName}
											class="max-h-72 w-auto rounded object-contain"
											releaseUrl={props.actions?.releaseThumbnailUrl}
											src={resolveThumbnail(item())}
										/>
									</div>
									<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
										<span>{sourceLabel(item().mediaSourceId)}</span>
										<Show when={item().width > 0 && item().height > 0}>
											<span>
												{item().width} × {item().height}
											</span>
										</Show>
										<span>{formatBytes(item().fileSize)}</span>
										<span>{formatDate(item().createdAt)}</span>
									</div>
									<DialogFooter>
										<Show when={props.actions?.openMedia}>
											{(openMedia) => (
												<Button
													class="min-h-11 sm:min-h-9"
													onClick={() => {
														const target = item();
														setPreview(null);
														openMedia()(target.mediaSourceId, target.id);
													}}
													type="button"
													variant="outline"
												>
													<ExternalLink class="size-4" />
													{t("duplicates.openDetail")}
												</Button>
											)}
										</Show>
										<Button
											class="min-h-11 sm:min-h-9"
											disabled={
												props.manager.isDeletingDuplicates() || isKept()
											}
											onClick={() => {
												props.manager.setKeepForGroup(groupId(), item().id);
											}}
											type="button"
										>
											{isKept()
												? t("duplicates.keep")
												: t("duplicates.keepThis")}
										</Button>
									</DialogFooter>
								</>
							);
						}}
					</Show>
				</DialogContent>
			</Dialog>
		</div>
	);
}

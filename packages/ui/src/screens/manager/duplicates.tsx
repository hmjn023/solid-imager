import { t } from "@solid-imager/i18n";
import { For, Show } from "solid-js";
import { Button } from "../../button";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../table";
import { formatBytes, formatDate } from "./utils";

const ALL_SOURCES_OPTION = { id: "__all__", name: t("labels.allSources") };

export function DuplicateToolPanel(props: { manager: UseManagerPageResult }) {
	const isScanning = () => props.manager.isScanningDuplicates();

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
					<div class="space-y-1.5">
						<Select
							class="space-y-1.5"
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
							<SelectLabel>{t("labels.targetSource")}</SelectLabel>
							<SelectTrigger class="w-full bg-card">
								<SelectValue<unknown>>
									{(state) => {
										const selected = state.selectedOption();
										return selected &&
											typeof selected === "object" &&
											"name" in selected
											? (selected as { name: string }).name
											: t("labels.allSources");
									}}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
					<Button
						class="w-full lg:w-auto"
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
							disabled={props.manager.isDeletingDuplicates()}
							onClick={props.manager.selectKeepOldest}
							size="sm"
							variant="outline"
						>
							{t("duplicates.keepOldest")}
						</Button>
						<Button
							disabled={props.manager.isDeletingDuplicates()}
							onClick={props.manager.selectKeepLargest}
							size="sm"
							variant="outline"
						>
							{t("duplicates.keepLargest")}
						</Button>
						<Button
							class="col-span-2 sm:col-auto"
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
						{(group, index) => (
							<div class="overflow-hidden rounded-md border border-border bg-card">
								<Table class="min-w-table-compact border-collapse caption-top text-left text-xs">
									<TableCaption class="mt-0 px-3 py-2 text-left font-medium text-sm text-foreground">
										{t("duplicates.groupValueValueItems", {
											value0: String(index() + 1),
											value1: String(group.media.length),
										})}
									</TableCaption>
									<TableHeader class="border-border border-t bg-muted text-muted-foreground">
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
												const keep = () => props.manager.keepIds().has(item.id);
												const thumbnail = () =>
													`/api/sources/${item.mediaSourceId}/thumbnail/${item.id}?t=${new Date(item.modifiedAt).getTime()}`;
												return (
													<TableRow
														class={
															keep() ? "bg-accent hover:bg-accent" : undefined
														}
													>
														<TableCell class="px-3 py-2">
															<img
																alt={t("duplicates.thumbnailForValue", {
																	value0: String(item.fileName),
																})}
																class="h-10 w-14 rounded object-cover"
																loading="lazy"
																src={thumbnail()}
															/>
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
															<Button
																aria-label={t("duplicates.keepValue", {
																	value0: String(item.fileName),
																})}
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
																{keep()
																	? t("duplicates.keep")
																	: t("duplicates.keepThis")}
															</Button>
														</TableCell>
													</TableRow>
												);
											}}
										</For>
									</TableBody>
								</Table>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

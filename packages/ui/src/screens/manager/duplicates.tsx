import { createSignal, For, Show } from "solid-js";
import { Button } from "../../button";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Label } from "../../label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../select";
import { formatBytes, formatDate } from "./utils";

const ALL_SOURCES_OPTION = { id: "__all__", name: "All sources" };

export function DuplicateToolPanel(props: { manager: UseManagerPageResult }) {
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

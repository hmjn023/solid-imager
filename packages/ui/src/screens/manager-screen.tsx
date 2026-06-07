import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { DuplicateGroup, Media } from "@solid-imager/core/domain/media/schemas";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
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
import { Button } from "../button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../card";
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
import { PaginationControls } from "../pagination-controls";
import { Progress } from "../progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";

export type ManagerScreenProps = {
	manager: UseManagerPageResult;
	renderMediaCard: (
		media: Media,
		selected: boolean,
		onToggle: (mediaId: string) => void,
	) => JSX.Element;
};

const managerTabs: ManagerEntityType[] = [
	"projects",
	"ips",
	"characters",
	"tagging",
	"duplicates",
];

function tabLabel(tab: ManagerEntityType) {
	if (tab === "tagging") {
		return "Batch Tagging";
	}
	if (tab === "ips") {
		return "IPs";
	}
	if (tab === "duplicates") {
		return "Duplicates";
	}
	return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function isCharacter(item: ManagerEntity) {
	return "ips" in item;
}

export function ManagerScreen(props: ManagerScreenProps) {
	const manager = () => props.manager;

	return (
		<div class="container mx-auto p-8">
			<div class="mb-8 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Entity Manager</h1>
				<Show when={manager().activeTab() !== "tagging" && manager().activeTab() !== "duplicates"}>
					<Button onClick={manager().openCreateDialog}>Create New</Button>
				</Show>
			</div>

			<div class="mb-6 flex space-x-4 border-b">
				<For each={managerTabs}>
					{(tab) => (
						<button
							class={`border-b-2 px-4 py-2 font-medium transition-colors ${
								manager().activeTab() === tab
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => manager().setActiveTab(tab)}
							type="button"
						>
							{tabLabel(tab)}
						</button>
					)}
				</For>
			</div>

			<Show when={manager().activeTab() === "tagging"}>
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Batch AI Tagging</CardTitle>
							<CardDescription>
								Analyze and tag images across your media sources using AI.
							</CardDescription>
						</CardHeader>
						<CardContent class="space-y-4">
							<div class="grid gap-2">
								<Label>Target Media Source (Optional)</Label>
								<Select
									itemComponent={(selectProps) => (
										<SelectItem item={selectProps.item}>
											{selectProps.item.rawValue.name}
										</SelectItem>
									)}
									onChange={(value) => manager().setSelectedSourceId(value?.id)}
									options={manager().sources()}
									optionTextValue="name"
									optionValue="id"
									placeholder="All Sources"
									value={
										manager().selectedSourceId()
											? manager()
													.sources()
													.find(
														(source) =>
															source.id === manager().selectedSourceId(),
													)
											: null
									}
								>
									<SelectTrigger>
										<SelectValue<unknown>>
											{(state) => {
												const option = state.selectedOption();
												return option &&
													typeof option === "object" &&
													"name" in option
													? (option as { name: string }).name
													: "All Sources";
											}}
										</SelectValue>
									</SelectTrigger>
									<SelectContent />
								</Select>
								<p class="text-muted-foreground text-xs">
									Leave empty to process all sources.
								</p>
							</div>

							<div class="flex items-center space-x-2">
								<Checkbox
									checked={manager().forceRetag()}
									class="flex items-center space-x-2"
									id="force-retag"
									onChange={manager().setForceRetag}
								>
									<CheckboxControl />
									<CheckboxLabel>Force Re-tagging</CheckboxLabel>
								</Checkbox>
							</div>
							<p class="text-muted-foreground text-xs">
								If checked, existing AI tags will be ignored and images will be
								re-analyzed.
							</p>

							<div class="flex items-center gap-x-2 pt-2">
								<Button onClick={manager().handleScan}>Scan for Targets</Button>
								<Button
									disabled={manager().scannedMedia().length === 0}
									onClick={manager().handleStartBatchTagging}
								>
									Start Batch Tagging ({manager().selectedMedia().size})
								</Button>
							</div>

							<Show when={manager().taggingStatus()}>
								<div class="mt-4 rounded bg-gray-100 p-2 text-sm">
									{manager().taggingStatus()}
								</div>
							</Show>
							<Show when={manager().jobProgress()}>
								{(progress) => (
									<div class="mt-4">
										<Progress
											value={(progress().processed / progress().total) * 100}
										/>
									</div>
								)}
							</Show>
						</CardContent>
					</Card>

					<Show when={manager().scannedMedia().length > 0}>
						<div class="mt-4">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="font-bold text-lg">
									Scanned Media ({manager().scannedMedia().length})
								</h3>
								<div class="flex items-center gap-2">
									<PaginationControls
										currentPage={manager().currentPage()}
										onPageChange={manager().setCurrentPage}
										totalPages={manager().totalPages()}
									/>
									<Button
										onClick={manager().toggleSelectAll}
										size="sm"
										variant="outline"
									>
										{manager().selectedMedia().size ===
										manager().scannedMedia().length
											? "Deselect All"
											: "Select All"}
									</Button>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								<For each={manager().paginatedMedia()}>
									{(media) =>
										props.renderMediaCard(
											media,
											manager().selectedMedia().has(media.id),
											manager().toggleMediaSelection,
										)
									}
								</For>
							</div>

							<div class="mt-4 flex justify-center">
								<PaginationControls
									currentPage={manager().currentPage()}
									onPageChange={manager().setCurrentPage}
									totalPages={manager().totalPages()}
								/>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			<Show when={manager().activeTab() === "duplicates"}>
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Duplicate Image Detection</CardTitle>
							<CardDescription>
								Find duplicate images by filename pattern or source URL matching.
							</CardDescription>
						</CardHeader>
						<CardContent class="space-y-4">
							<div class="grid gap-2">
								<Label>Target Media Source (Optional)</Label>
								<Select
									itemComponent={(selectProps) => (
										<SelectItem item={selectProps.item}>
											{selectProps.item.rawValue.name}
										</SelectItem>
									)}
									onChange={(value) => manager().setDuplicateSourceId(value?.id)}
									options={manager().sources()}
									optionTextValue="name"
									optionValue="id"
									placeholder="All Sources"
									value={
										manager().duplicateSourceId()
											? manager()
													.sources()
													.find(
														(source) =>
															source.id === manager().duplicateSourceId(),
													)
											: null
									}
								>
									<SelectTrigger>
										<SelectValue<unknown>>
											{(state) => {
												const option = state.selectedOption();
												return option &&
													typeof option === "object" &&
													"name" in option
													? (option as { name: string }).name
													: "All Sources";
											}}
										</SelectValue>
									</SelectTrigger>
									<SelectContent />
								</Select>
							</div>

							<div class="flex items-center gap-x-2 pt-2">
								<Button onClick={manager().handleScanDuplicates}>
									Scan for Duplicates
								</Button>
							</div>

							<Show when={manager().duplicateStatus()}>
								<div class="rounded bg-gray-100 p-2 text-sm">
									{manager().duplicateStatus()}
								</div>
							</Show>
						</CardContent>
					</Card>

					<Show when={manager().duplicateGroups().length > 0}>
						<div class="flex items-center justify-between">
							<h3 class="font-bold text-lg">
								Duplicate Groups ({manager().duplicateGroups().length})
							</h3>
							<div class="flex gap-2">
								<Button onClick={manager().selectKeepOldest} size="sm" variant="outline">
									Keep Oldest
								</Button>
								<Button onClick={manager().selectKeepLargest} size="sm" variant="outline">
									Keep Largest
								</Button>
								<Button onClick={manager().handleDeleteDuplicates} variant="destructive">
									Delete{" "}
									{(() => {
										const groups = manager().duplicateGroups();
										const keep = manager().keepIds();
										let count = 0;
										for (const g of groups) {
											for (const m of g.media) {
												if (!keep.has(m.id)) count++;
											}
										}
										return count;
									})()}{" "}
									Duplicates
								</Button>
							</div>
						</div>

						<div class="space-y-4">
							<For each={manager().duplicateGroups()}>
								{(group: DuplicateGroup) => (
									<Card>
										<CardHeader class="pb-2">
											<div class="flex items-center gap-2">
												<CardTitle class="text-base">
													{group.media.length} items
												</CardTitle>
												<span class="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs">
													{group.reason === "filename" ? "Filename" : "Source URL"}
												</span>
											</div>
										</CardHeader>
										<CardContent>
											<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
												<For each={group.media}>
													{(item) => {
														const thumbnailUrl = () =>
															`/api/sources/${item.mediaSourceId}/${item.id}/thumbnail?t=${new Date(item.modifiedAt).getTime()}`;
														const isKeep = () => manager().keepIds().has(item.id);

														return (
															<button
																class={`cursor-pointer rounded-lg border-2 p-2 text-left transition-colors ${
																	isKeep()
																		? "border-primary bg-primary/5"
																		: "border-transparent hover:border-gray-300"
																}`}
																onClick={() =>
																	manager().setKeepForGroup(group.id, item.id)
																}
																type="button"
															>
																<div class="relative mb-2 aspect-video w-full overflow-hidden rounded bg-gray-100">
																	<img
																		alt={item.fileName}
																		class="h-full w-full object-cover"
																		src={thumbnailUrl()}
																	/>
																	<Show when={isKeep()}>
																		<div class="absolute top-1 right-1 rounded-full bg-primary px-1.5 py-0.5 font-bold text-primary-foreground text-xs">
																			Keep
																		</div>
																	</Show>
																</div>
																<p class="truncate font-medium text-xs" title={item.fileName}>
																	{item.fileName}
																</p>
																<p class="text-muted-foreground text-xs">
																	{item.width}×{item.height}{" "}
																	{item.fileSize != null
																		? `· ${(item.fileSize / 1024).toFixed(1)} KB`
																		: ""}
																</p>
																<p class="text-muted-foreground text-xs">
																	{new Date(item.createdAt).toLocaleDateString()}
																</p>
																<Show when={item.sourceUrls.length > 0}>
																	<div class="mt-1 max-h-12 overflow-y-auto">
																		<For each={item.sourceUrls.slice(0, 2)}>
																			{(url) => (
																				<p class="truncate text-muted-foreground text-xs">
																					{url}
																				</p>
																			)}
																		</For>
																		<Show when={item.sourceUrls.length > 2}>
																			<p class="text-muted-foreground text-xs">
																				+{item.sourceUrls.length - 2} more
																			</p>
																		</Show>
																	</div>
																</Show>
															</button>
														);
													}}
												</For>
											</div>
										</CardContent>
									</Card>
								)}
							</For>
						</div>
					</Show>
				</div>
			</Show>

			<Show when={manager().activeTab() !== "tagging" && manager().activeTab() !== "duplicates"}>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<For each={manager().getActiveItems()}>
						{(item) => (
							<Card>
								<CardHeader>
									<CardTitle>{item.name}</CardTitle>
									<Show when={item.description}>
										<CardDescription>{item.description}</CardDescription>
									</Show>
									<Show
										when={
											manager().activeTab() === "characters" &&
											isCharacter(item) &&
											item.ips.length > 0
										}
									>
										<CardDescription>
											IPs:{" "}
											{isCharacter(item)
												? item.ips.map((ip) => ip.name).join(", ")
												: ""}
										</CardDescription>
									</Show>
								</CardHeader>
								<CardContent>
									<div class="flex justify-end space-x-2">
										<Button
											onClick={() => manager().openEditDialog(item)}
											size="sm"
											variant="outline"
										>
											Edit
										</Button>
										<Button
											onClick={() => {
												manager().setItemToDelete(item);
												manager().setIsDeleteDialogOpen(true);
											}}
											size="sm"
											variant="destructive"
										>
											Delete
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</For>
				</div>
			</Show>

			<Dialog
				onOpenChange={manager().setIsDialogOpen}
				open={manager().isDialogOpen()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{manager().editingItem() ? "Edit" : "Create"}{" "}
							{manager().activeTab() === "tagging"
								? "TAGGING"
								: manager().activeTab().slice(0, -1).toUpperCase()}
						</DialogTitle>
						<DialogDescription>
							{manager().editingItem()
								? "Update the details of the item."
								: "Enter the details for the new item."}
						</DialogDescription>
					</DialogHeader>
					<div class="grid gap-4 py-4">
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right">Name</Label>
							<Input
								class="col-span-3"
								onInput={(event) =>
									manager().setFormData({
										...manager().formData(),
										name: event.currentTarget.value,
									})
								}
								value={manager().formData().name}
							/>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right">Description</Label>
							<Input
								class="col-span-3"
								onInput={(event) =>
									manager().setFormData({
										...manager().formData(),
										description: event.currentTarget.value,
									})
								}
								value={manager().formData().description}
							/>
						</div>
						<Show when={manager().activeTab() === "characters"}>
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right">IPs</Label>
								<div class="col-span-3">
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
											manager().setFormData({
												...manager().formData(),
												ipIds: values.map((value) => value.id),
											})
										}
										optionLabel="name"
										options={manager().ips()}
										optionTextValue="name"
										optionValue="id"
										value={manager()
											.ips()
											.filter((ip) =>
												manager().formData().ipIds?.includes(ip.id),
											)}
									>
										<ComboboxControl>
											<ComboboxInput placeholder="Select IPs..." />
											<ComboboxTrigger />
										</ComboboxControl>
										<ComboboxContent />
									</Combobox>
								</div>
							</div>
						</Show>
					</div>
					<DialogFooter>
						<Button onClick={manager().handleSave}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={manager().setIsDeleteDialogOpen}
				open={manager().isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the{" "}
							{manager().activeTab().slice(0, -1)} and remove it from our
							servers.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={manager().handleConfirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={manager().setIsDuplicateDeleteDialogOpen}
				open={manager().isDuplicateDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Duplicate Images?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. The following{" "}
							{manager().duplicatesToDelete().length} image(s) will be
							permanently deleted:
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div class="max-h-48 overflow-y-auto text-sm">
						<For each={manager().duplicatesToDelete()}>
							{(item) => (
								<div class="truncate border-b py-1 text-muted-foreground">
									{item.fileName}
								</div>
							)}
						</For>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={manager().handleConfirmDeleteDuplicates}
						>
							Delete {manager().duplicatesToDelete().length} Items
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

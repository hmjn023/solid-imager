import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { DuplicateGroup } from "@solid-imager/core/domain/media/schemas";
import { For, Match, Show, Switch } from "solid-js";
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
import { Progress } from "../progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import { CardGridSkeleton, LoadingRegion } from "../skeleton";

export type ManagerScreenProps = {
	manager: UseManagerPageResult;
};

const managerTabs: ManagerEntityType[] = [
	"projects",
	"ips",
	"characters",
	"tagging",
	"vectors",
	"duplicates",
];

function tabLabel(tab: ManagerEntityType) {
	if (tab === "tagging") {
		return "Batch Tagging";
	}
	if (tab === "vectors") {
		return "Vector Extraction";
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

function isCrudTab(tab: ManagerEntityType) {
	return tab === "projects" || tab === "ips" || tab === "characters";
}

const ALL_SOURCES_OPTION = { id: "__all__", name: "All Sources" };

export function ManagerScreen(props: ManagerScreenProps) {
	const manager = () => props.manager;
	const activeQueryState = () => {
		const states = manager().queryStates();
		switch (manager().activeTab()) {
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
	const canRenderActiveTab = () =>
		activeQueryState().phase === "data" ||
		(activeQueryState().phase === "empty" && !isCrudTab(manager().activeTab()));
	const characterIpState = () => manager().queryStates().ips;
	const hasCharacterIpError = () =>
		manager().activeTab() === "characters" &&
		(characterIpState().phase === "error" ||
			characterIpState().phase === "offline");

	return (
		<div class="container mx-auto px-3 py-4 sm:p-8">
			<div class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<h1 class="font-bold text-2xl sm:text-3xl">Entity Manager</h1>
				<Show
					when={
						isCrudTab(manager().activeTab()) &&
						activeQueryState().phase !== "empty"
					}
				>
					<Button class="w-full sm:w-auto" onClick={manager().openCreateDialog}>
						Create New
					</Button>
				</Show>
			</div>

			<div class="-mx-3 mb-6 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:gap-4 sm:px-0">
				<For each={managerTabs}>
					{(tab) => (
						<button
							aria-pressed={manager().activeTab() === tab}
							class={`min-h-11 shrink-0 border-b-2 px-3 py-2 font-medium transition-colors sm:px-4 ${
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

			<QueryStatus
				class="mb-4"
				fetchState={activeQueryState().fetchState}
				hasData={activeQueryState().data !== undefined}
				offlineLabel="オフラインのため保存済みの管理データを表示しています。"
				updatingLabel="管理データを更新中..."
			/>
			<Show when={hasCharacterIpError()}>
				<div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-foreground/30 bg-warning/40 p-3">
					<p class="text-muted-foreground text-sm" role="status">
						IP候補を取得できませんでした。Characters一覧は引き続き利用できます。
					</p>
					<RetryButton
						class="h-8 px-3 text-xs"
						label="IP候補を再取得"
						onRetry={manager().retryQueries}
					/>
				</div>
			</Show>

			<Switch>
				<Match when={activeQueryState().phase === "pending"}>
					<LoadingRegion label="管理データを読み込んでいます...">
						<CardGridSkeleton />
					</LoadingRegion>
				</Match>
				<Match when={activeQueryState().phase === "error"}>
					<ErrorState
						description="接続を確認して、もう一度お試しください。"
						onRetry={manager().retryQueries}
						title="管理データを取得できませんでした"
					/>
				</Match>
				<Match when={activeQueryState().phase === "offline"}>
					<OfflineState
						description="接続が戻ったら、この画面から再試行できます。"
						onRetry={manager().retryQueries}
					/>
				</Match>
				<Match
					when={
						activeQueryState().phase === "empty" &&
						isCrudTab(manager().activeTab())
					}
				>
					<EmptyState
						description="最初の項目を作成すると、ここに表示されます。"
						title={`登録された ${tabLabel(manager().activeTab())} はありません`}
					>
						<Button onClick={manager().openCreateDialog}>Create New</Button>
					</EmptyState>
				</Match>
			</Switch>

			<Show
				when={
					(manager().activeTab() === "tagging" ||
						manager().activeTab() === "vectors") &&
					canRenderActiveTab()
				}
			>
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>
								{manager().activeTab() === "vectors"
									? "Batch CCIP Vector Extraction"
									: "Batch AI Tagging"}
							</CardTitle>
							<CardDescription>
								{manager().activeTab() === "vectors"
									? "Extract CCIP character embeddings for similarity search."
									: "Analyze and tag images across your media sources using AI."}
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
									<CheckboxLabel>
										{manager().activeTab() === "vectors"
											? "Force Re-extraction"
											: "Force Re-tagging"}
									</CheckboxLabel>
								</Checkbox>
							</div>
							<p class="text-muted-foreground text-xs">
								{manager().activeTab() === "vectors"
									? "If checked, existing CCIP vectors are overwritten."
									: "If checked, existing AI tags will be ignored and images will be re-analyzed."}
							</p>

							<div class="sticky bottom-0 z-10 -mx-2 flex flex-col gap-2 border-t bg-card px-2 py-3 sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
								<Button class="w-full sm:w-auto" onClick={manager().handleScan}>
									Scan for Targets
								</Button>
								<Button
									class="w-full sm:w-auto"
									onClick={
										manager().activeTab() === "vectors"
											? manager().handleStartBatchCcipExtraction
											: manager().handleStartBatchTagging
									}
								>
									{manager().activeTab() === "vectors"
										? "Start Vector Extraction"
										: "Start Batch Tagging"}
								</Button>
							</div>

							<Show when={manager().taggingStatus()}>
								<div class="mt-4 break-words rounded bg-gray-100 p-2 text-sm">
									{manager().taggingStatus()}
								</div>
							</Show>
							<Show when={manager().jobProgress()}>
								{(progress) => (
									<div class="mt-4 space-y-2" role="status">
										<div class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-muted-foreground text-sm">
											<span>Batch progress</span>
											<span>
												{progress().processed} / {progress().total}
											</span>
										</div>
										<Progress
											value={(progress().processed / progress().total) * 100}
										/>
									</div>
								)}
							</Show>
						</CardContent>
					</Card>
				</div>
			</Show>

			<Show
				when={manager().activeTab() === "duplicates" && canRenderActiveTab()}
			>
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Duplicate Image Detection</CardTitle>
							<CardDescription>
								Find duplicate images by filename pattern or source URL
								matching.
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
									onChange={(value) =>
										manager().setDuplicateSourceId(
											value?.id === "__all__" ? undefined : value?.id,
										)
									}
									options={[ALL_SOURCES_OPTION, ...manager().sources()]}
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
											: ALL_SOURCES_OPTION
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

							<div class="sticky bottom-0 z-10 -mx-2 flex flex-col gap-2 border-t bg-card px-2 py-3 sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
								<Button
									class="w-full sm:w-auto"
									onClick={manager().handleScanDuplicates}
								>
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
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<h3 class="font-bold text-lg">
								Duplicate Groups ({manager().duplicateGroups().length})
							</h3>
							<div class="grid grid-cols-2 gap-2 sm:flex">
								<Button
									class="w-full sm:w-auto"
									onClick={manager().selectKeepOldest}
									size="sm"
									variant="outline"
								>
									Keep Oldest
								</Button>
								<Button
									class="w-full sm:w-auto"
									onClick={manager().selectKeepLargest}
									size="sm"
									variant="outline"
								>
									Keep Largest
								</Button>
								<Button
									class="col-span-2 w-full sm:col-auto sm:w-auto"
									onClick={manager().handleDeleteDuplicates}
									variant="destructive"
								>
									Delete {manager().deleteCount()} Duplicates
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
													Source URL
												</span>
											</div>
										</CardHeader>
										<CardContent>
											<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
												<For each={group.media}>
													{(item) => {
														const thumbnailUrl = () =>
															`/api/sources/${item.mediaSourceId}/thumbnail/${item.id}?t=${new Date(item.modifiedAt).getTime()}`;
														const isKeep = () =>
															manager().keepIds().has(item.id);

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
																<p
																	class="truncate font-medium text-xs"
																	title={item.fileName}
																>
																	{item.fileName}
																</p>
																<p class="text-muted-foreground text-xs">
																	{item.width}×{item.height}{" "}
																	{item.fileSize != null
																		? `· ${(item.fileSize / 1024).toFixed(1)} KB`
																		: ""}
																</p>
																<p class="text-muted-foreground text-xs">
																	{new Date(
																		item.createdAt,
																	).toLocaleDateString()}
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

			<Show
				when={
					isCrudTab(manager().activeTab()) &&
					activeQueryState().phase === "data"
				}
			>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<For each={manager().getActiveItems()}>
						{(item) => (
							<Card>
								<CardHeader class="min-w-0">
									<CardTitle class="break-words">{item.name}</CardTitle>
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
									<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
										<Button
											aria-label={`Edit ${item.name}`}
											class="w-full sm:w-auto"
											onClick={() => manager().openEditDialog(item)}
											size="sm"
											variant="outline"
										>
											Edit
										</Button>
										<Button
											class="w-full sm:w-auto"
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
							{manager().activeTab() === "tagging" ||
							manager().activeTab() === "vectors"
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
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label class="sm:text-right" for="manager-entity-name">
								Name
							</Label>
							<Input
								class="w-full text-base sm:col-span-3 sm:text-sm"
								id="manager-entity-name"
								onInput={(event) =>
									manager().setFormData({
										...manager().formData(),
										name: event.currentTarget.value,
									})
								}
								value={manager().formData().name}
							/>
						</div>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
							<Label class="sm:text-right" for="manager-entity-description">
								Description
							</Label>
							<Input
								class="w-full text-base sm:col-span-3 sm:text-sm"
								id="manager-entity-description"
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
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
								<Label class="sm:text-right" for="manager-entity-ips">
									IPs
								</Label>
								<div class="w-full sm:col-span-3">
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
											<ComboboxInput
												id="manager-entity-ips"
												placeholder="Select IPs..."
											/>
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

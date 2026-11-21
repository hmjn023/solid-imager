import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createEffect,
	createResource,
	createSignal,
	createUniqueId,
	For,
	on,
	Show,
	untrack,
} from "solid-js";
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
import { sourceTypeLabel } from "./display-labels";
import {
	getPendingImportPrimaryAuthor,
	getPreferredImportSourceId,
} from "./import-inbox-helpers";
import type {
	ImportReviewModalProps,
	PendingImportJob,
} from "./import-review-modal.types";
import {
	getRememberedImportSourceId,
	isImportSourceRemembered,
	setImportSourcePreference,
} from "./import-source-preference";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./select";
import { toast } from "./toast";
import { Maximize2 } from "./workspace/icons";

type ImportSourceOption = {
	id: string;
	label: string;
};

function getPreviewUrl(url?: string): string {
	if (!url) {
		return "";
	}

	try {
		const urlObject = new URL(url);
		if (
			urlObject.hostname === "pbs.twimg.com" &&
			urlObject.searchParams.get("name") === "orig"
		) {
			urlObject.searchParams.set("name", "small");
			return urlObject.toString();
		}
	} catch {
		// Ignore invalid URLs and use the original string.
	}

	return url;
}

function ImportPreviewImage(props: { src?: string; expanded?: boolean }) {
	const [failed, setFailed] = createSignal(false);
	return (
		<div
			class="overflow-hidden rounded-md bg-muted"
			classList={{ "aspect-landscape": !props.expanded }}
		>
			<Show
				when={!failed() && props.src}
				fallback={
					<div class="flex h-full min-h-thumbnail-preview items-center justify-center px-2 text-muted-foreground text-xs">
						{t("importReviewModal.noPreview")}
					</div>
				}
			>
				{(src) => (
					<img
						alt={props.expanded ? t("importReviewModal.importPreview") : ""}
						class="block w-full"
						classList={{
							"max-h-dialog-screen-compact object-contain": props.expanded,
							"h-full object-cover": !props.expanded,
						}}
						loading={props.expanded ? "eager" : "lazy"}
						onError={() => setFailed(true)}
						src={src()}
					/>
				)}
			</Show>
		</div>
	);
}

function ImportReviewCard(props: {
	item: PendingImportJob["item"];
	checked: boolean;
	disabled: boolean;
	onToggle: () => void;
}) {
	const titleId = createUniqueId();
	const title = () =>
		props.item.description ||
		props.item.fileName ||
		props.item.targetUrl ||
		t("importReviewModal.untitledImport");
	const author = () => getPendingImportPrimaryAuthor(props.item);
	return (
		<div
			class="flex min-w-0 flex-col rounded-lg border border-border bg-card transition-colors"
			classList={{ "border-primary bg-primary/5": props.checked }}
		>
			<Checkbox
				checked={props.checked}
				class="relative min-w-0 flex-1 rounded-t-lg focus-within:ring-2 focus-within:ring-ring hover:bg-accent/50"
				disabled={props.disabled}
				onChange={props.onToggle}
			>
				<CheckboxControl class="absolute top-3 right-3 z-10 size-5 border-input bg-background" />
				<CheckboxLabel class="block h-full cursor-pointer p-2">
					<ImportPreviewImage src={getPreviewUrl(props.item.targetUrl)} />
					<p
						class="mt-2 line-clamp-3 wrap-anywhere font-medium text-sm"
						id={titleId}
					>
						{title()}
					</p>
					<p class="truncate text-muted-foreground text-xs">{author()}</p>
				</CheckboxLabel>
			</Checkbox>
			<Dialog>
				<DialogTrigger
					aria-describedby={titleId}
					as={Button}
					class="min-h-11 w-full rounded-t-none border-border border-t"
					disabled={props.disabled}
					size="sm"
					variant="ghost"
				>
					<Maximize2 aria-hidden="true" size={14} />
					{t("importReviewModal.preview")}
				</DialogTrigger>
				<DialogContent class="workspace-theme block max-w-dialog-xl gap-0 p-0 [&>button]:top-1 [&>button]:right-1 [&>button]:z-20 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center">
					<DialogHeader class="flex min-h-14 items-center border-border border-b px-4 py-3 pr-14 text-left">
						<DialogTitle>{t("importReviewModal.importPreview")}</DialogTitle>
					</DialogHeader>
					<div class="space-y-3 px-3 py-4 sm:px-5">
						<div class="space-y-1">
							<p class="wrap-anywhere whitespace-pre-wrap font-medium text-sm">
								{title()}
							</p>
							<Show
								when={props.item.fileName && props.item.fileName !== title()}
							>
								<p class="wrap-anywhere text-muted-foreground text-sm">
									{props.item.fileName}
								</p>
							</Show>
							<Show when={props.item.authors?.[0]?.name}>
								{(name) => (
									<p class="wrap-anywhere text-muted-foreground text-sm">
										{name()}
									</p>
								)}
							</Show>
						</div>
						<ImportPreviewImage expanded src={props.item.targetUrl} />
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export function ImportReviewModal(props: ImportReviewModalProps) {
	const createEmptySelection = () => new Set<string>();
	const [selectedJobIds, setSelectedJobIds] = createSignal(
		createEmptySelection(),
	);
	const [selectedSourceId, setSelectedSourceId] = createSignal("");
	const [sourceField, setSourceField] = createSignal<HTMLDivElement>();
	const [rememberSource, setRememberSource] = createSignal(
		isImportSourceRemembered(),
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDiscardDialogOpen, setIsDiscardDialogOpen] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [activeAction, setActiveAction] = createSignal<
		"import" | "delete" | null
	>(null);
	const [openGeneration, setOpenGeneration] = createSignal<number>();
	let openCount = 0;

	const [pendingJobs, { refetch: refetchJobs }] = createResource(
		openGeneration,
		props.listPending,
	);
	const [sources] = createResource(openGeneration, props.listSources);

	createEffect(
		on(
			() => props.isOpen,
			(isOpen) => {
				if (!isOpen) return;
				setIsDirty(false);
				setIsDiscardDialogOpen(false);
				setOpenGeneration(++openCount);
			},
		),
	);

	createEffect(() => {
		const jobs = pendingJobs();
		if (jobs?.length) {
			setSelectedJobIds(new Set(jobs.map((job) => job.id)));
			return;
		}
		setSelectedJobIds(createEmptySelection());
	});

	createEffect(() => {
		if (!props.isOpen) return;
		const sourceList = sources();
		if (!sourceList?.length) {
			setSelectedSourceId("");
			return;
		}

		const shouldRememberSource = untrack(rememberSource);
		const rememberedSourceId = shouldRememberSource
			? getRememberedImportSourceId(sourceList)
			: null;
		const nextSourceId =
			rememberedSourceId ?? getPreferredImportSourceId(sourceList);
		setSelectedSourceId(nextSourceId);
		if (shouldRememberSource && nextSourceId !== rememberedSourceId) {
			setImportSourcePreference(true, nextSourceId);
		}
	});

	const toggleSelection = (id: string) => {
		const current = new Set(selectedJobIds());
		if (current.has(id)) {
			current.delete(id);
		} else {
			current.add(id);
		}
		setSelectedJobIds(current);
		setIsDirty(true);
	};
	const selectAll = () => {
		const jobs = pendingJobs() ?? [];
		if (jobs.length === 0 || selectedJobIds().size === jobs.length) return;
		setSelectedJobIds(new Set(jobs.map((job) => job.id)));
		setIsDirty(true);
	};
	const clearSelection = () => {
		if (selectedJobIds().size === 0) return;
		setSelectedJobIds(createEmptySelection());
		setIsDirty(true);
	};
	const requestClose = () => {
		if (activeAction() !== null) return;
		if (isDirty()) {
			setIsDiscardDialogOpen(true);
			return;
		}
		props.onClose();
	};
	const discardAndClose = () => {
		setIsDirty(false);
		setIsDiscardDialogOpen(false);
		props.onClose();
	};

	const handleProcess = async () => {
		const jobIds = Array.from(selectedJobIds());
		const sourceId = selectedSourceId();
		if (!jobIds.length || !sourceId) {
			return;
		}

		try {
			setActiveAction("import");
			await props.processPending(jobIds, sourceId);
			setIsDirty(false);
			props.onImportCompleted();
			props.onClose();
		} catch (error) {
			toast.error(
				t("importReviewModal.failedToProcessImportsValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setActiveAction(null);
		}
	};

	const handleRememberSourceChange = (remember: boolean) => {
		setRememberSource(remember);
		setImportSourcePreference(
			remember,
			remember ? selectedSourceId() : undefined,
		);
	};

	const sourceOptions = (): ImportSourceOption[] =>
		(sources() ?? []).flatMap((source) =>
			source.id
				? [
						{
							id: source.id,
							label: `${source.name} · ${sourceTypeLabel(source.type)}`,
						},
					]
				: [],
		);
	const selectedSourceOption = () =>
		sourceOptions().find((option) => option.id === selectedSourceId()) ?? null;

	const confirmDelete = async () => {
		try {
			setActiveAction("delete");
			await props.cancelPending(Array.from(selectedJobIds()));
			await refetchJobs();
			setSelectedJobIds(createEmptySelection());
			setIsDirty(false);
			setIsDeleteDialogOpen(false);
			toast.success(t("importReviewModal.requestsDeleted"));
		} catch (error) {
			toast.error(
				t("importReviewModal.failedToCancelImportsValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setActiveAction(null);
		}
	};

	return (
		<>
			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						requestClose();
					}
				}}
				open={props.isOpen}
			>
				<DialogContent
					class="workspace-theme flex max-h-dialog-fit max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:top-2 [&>button]:right-2 [&>button]:z-20 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center"
					closeDisabled={activeAction() !== null}
				>
					<DialogHeader class="border-b px-5 py-4 pr-14 text-left">
						<DialogTitle>{t("navigation.importInbox")}</DialogTitle>
						<DialogDescription>
							{t(
								"importReviewModal.reviewDownloadedMediaChooseASourceThenImportThe",
							)}
						</DialogDescription>
					</DialogHeader>

					<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div class="flex flex-col gap-3 border-border border-b bg-muted px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
							<div class="grid min-w-0 gap-2 sm:w-80" ref={setSourceField}>
								<Select<ImportSourceOption>
									class="grid gap-1"
									disabled={sources.loading || activeAction() !== null}
									disallowEmptySelection
									itemComponent={(itemProps) => (
										<SelectItem item={itemProps.item}>
											{itemProps.item.rawValue.label}
										</SelectItem>
									)}
									onChange={(option) => {
										if (!option) return;
										setSelectedSourceId(option.id);
										if (rememberSource()) {
											setImportSourcePreference(true, option.id);
										}
										setIsDirty(true);
									}}
									options={sourceOptions()}
									optionTextValue="label"
									optionValue="id"
									placeholder={t("actions.selectSource")}
									value={selectedSourceOption()}
								>
									<SelectLabel>
										{t("importReviewModal.targetSource")}
									</SelectLabel>
									<SelectTrigger class="w-full bg-background">
										<SelectValue<ImportSourceOption>>
											{(state) => state.selectedOption()?.label ?? ""}
										</SelectValue>
									</SelectTrigger>
									<SelectContent
										class="max-h-popover-fit-available"
										portalMount={sourceField()}
									/>
								</Select>
								<Checkbox
									checked={rememberSource()}
									class="flex items-center gap-2"
									disabled={sources.loading || activeAction() !== null}
									onChange={handleRememberSourceChange}
								>
									<CheckboxControl />
									<CheckboxLabel class="cursor-pointer font-normal text-muted-foreground text-sm">
										{t("importReviewModal.rememberThisSource")}
									</CheckboxLabel>
								</Checkbox>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
								<div class="text-muted-foreground text-sm" aria-live="polite">
									{t("importReviewModal.valueOfValueValueSelected", {
										value0: String(selectedJobIds().size),
										value1: String(pendingJobs()?.length ?? 0),
									})}
								</div>
								<div class="flex items-center gap-1">
									<Button
										class="h-8 px-2 text-xs"
										disabled={
											activeAction() !== null ||
											(pendingJobs()?.length ?? 0) === 0 ||
											selectedJobIds().size === (pendingJobs()?.length ?? 0)
										}
										onClick={selectAll}
										size="sm"
										variant="ghost"
									>
										{t("importReviewModal.selectAll")}
									</Button>
									<Button
										class="h-8 px-2 text-xs"
										disabled={
											activeAction() !== null || selectedJobIds().size === 0
										}
										onClick={clearSelection}
										size="sm"
										variant="ghost"
									>
										{t("actions.clear")}
									</Button>
								</div>
							</div>
						</div>

						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
							<Show when={pendingJobs.loading}>
								<div class="flex min-h-48 items-center justify-center text-muted-foreground text-sm">
									{t("importReviewModal.loadingImportInbox")}
								</div>
							</Show>
							<Show
								when={
									!pendingJobs.loading &&
									!pendingJobs.error &&
									(pendingJobs()?.length ?? 0) > 0
								}
							>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
									<For each={pendingJobs()}>
										{(job) => (
											<ImportReviewCard
												checked={selectedJobIds().has(job.id)}
												disabled={activeAction() !== null}
												item={job.item}
												onToggle={() => toggleSelection(job.id)}
											/>
										)}
									</For>
								</div>
							</Show>
							<Show when={!pendingJobs.loading && Boolean(pendingJobs.error)}>
								<div class="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
									<p class="text-destructive text-sm">
										{t("importReviewModal.failedToLoadImportInbox")}
									</p>
									<Button onClick={() => void refetchJobs()} variant="outline">
										{t("actions.retry")}
									</Button>
								</div>
							</Show>
							<Show
								when={
									!pendingJobs.loading &&
									!pendingJobs.error &&
									pendingJobs()?.length === 0
								}
							>
								<div class="flex min-h-48 flex-col items-center justify-center gap-1 text-center">
									<p class="font-medium">
										{t("importReviewModal.importInboxIsEmpty")}
									</p>
									<p class="text-muted-foreground text-sm">
										{t("importReviewModal.newBulkUploadRequestsWillAppearHere")}
									</p>
								</div>
							</Show>
						</div>
					</div>

					<DialogFooter class="flex-row border-t px-3 py-3 sm:px-5 [&>button]:w-auto">
						<Button
							class="flex-1 px-2 text-destructive hover:text-destructive sm:mr-auto sm:flex-none sm:px-4"
							disabled={selectedJobIds().size === 0 || activeAction() !== null}
							onClick={() => setIsDeleteDialogOpen(true)}
							variant="outline"
						>
							{t("importReviewModal.deleteSelected")}
						</Button>
						<Button
							class="hidden sm:inline-flex"
							disabled={activeAction() !== null}
							onClick={requestClose}
							variant="outline"
						>
							{t("actions.close")}
						</Button>
						<Button
							class="flex-1 px-2 sm:flex-none sm:px-4"
							disabled={
								selectedJobIds().size === 0 ||
								!selectedSourceId() ||
								activeAction() !== null
							}
							onClick={() => void handleProcess()}
						>
							{activeAction() === "import"
								? t("importReviewModal.importing")
								: t("importReviewModal.importValue", {
										value0: String(
											selectedJobIds().size
												? t("importReviewModal.value", {
														value0: String(selectedJobIds().size),
													})
												: "",
										),
									})}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AlertDialog
				onOpenChange={setIsDiscardDialogOpen}
				open={isDiscardDialogOpen()}
			>
				<AlertDialogContent class="workspace-theme">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("importReviewModal.discardSelectedChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t(
								"importReviewModal.yourSelectedItemsAndTargetSourceHaveNotBeen",
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("importReviewModal.continueReviewing")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={discardAndClose}>
							{t("importReviewModal.discardAndClose")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog
				onOpenChange={(open) => {
					if (!open && activeAction() !== "delete") {
						setIsDeleteDialogOpen(false);
					}
				}}
				open={isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("importReviewModal.areYouSure")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("importReviewModal.thisWillRemoveValueImportRequests", {
								value0: String(selectedJobIds().size),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={activeAction() === "delete"}>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={activeAction() === "delete"}
							onClick={(event) => {
								event.preventDefault();
								void confirmDelete();
							}}
						>
							{activeAction() === "delete"
								? t("status.deleting")
								: t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

import { cn } from "./utils/cn";
import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createForm } from "./utils/create-form";
import X from "@lucide/solid/icons/x";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "./alert";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import {
	FormError,
	FormFieldMessage,
	getFormErrorMessage,
} from "./form-message";
import { type UploadFormValues, uploadFormSchema } from "./form-schemas";
import { Input } from "./input";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from "./radio-group";
import { createUploadDraft } from "./upload-draft";

export type UploadConflictResolution = "overwrite" | "skip" | "rename";

export type UploadConflict = {
	filename: string;
	existingFile?: string;
	suggestedName?: string;
};

export type UploadProgress = {
	filename?: string;
	status?: string;
	current?: number;
	total?: number;
};

export type UploadMediaModalSubmitOptions = {
	files: File[];
	filename: string;
	description: string;
	sourceUrl?: string;
	conflictResolution: UploadConflictResolution;
	overwrite: boolean;
	autoIncrement: boolean;
};

export type UploadMediaModalContentProps = {
	isOpen: boolean;
	onClose: () => void;
	initialFile: File | null;
	initialFiles?: File[];
	pastedUrl: string | null;
	onUploadStart: (options: UploadMediaModalSubmitOptions) => Promise<void>;
	onFetchUrl?: (url: string) => Promise<File>;
	conflicts?: UploadConflict[];
	uploadProgress?: UploadProgress | null;
};

function isUploadConflictResolution(
	value: string,
): value is UploadConflictResolution {
	return value === "overwrite" || value === "skip" || value === "rename";
}

const resolutionOptions: Array<{
	value: UploadConflictResolution;
	label: string;
	description: string;
}> = [
	{
		value: "overwrite",
		label: t("uploadMediaModal.overwrite"),
		description: t("uploadMediaModal.replaceTheExistingFileWhenNamesMatch"),
	},
	{
		value: "skip",
		label: t("uploadMediaModal.skip"),
		description: t("uploadMediaModal.doNotUploadFilesWhenNamesMatch"),
	},
	{
		value: "rename",
		label: t("uploadMediaModal.rename"),
		description: t("uploadMediaModal.addASequenceNumberWhenNamesMatch"),
	},
];

const EMPTY_UPLOAD_FORM: UploadFormValues = {
	filename: "",
	description: "",
	sourceUrl: "",
	conflictResolution: "skip",
};

function fileSizeLabel(file: File) {
	if (file.size < 1024) {
		return t("uploadMediaModal.valueB", { value0: String(file.size) });
	}
	if (file.size < 1024 * 1024) {
		return t("uploadMediaModal.valueKB", {
			value0: String((file.size / 1024).toFixed(1)),
		});
	}
	return t("uploadMediaModal.valueMB", {
		value0: String((file.size / (1024 * 1024)).toFixed(1)),
	});
}

export function UploadMediaModalContent(props: UploadMediaModalContentProps) {
	const draft = createUploadDraft({
		fetchFile: props.onFetchUrl,
		createPreview: (file) => URL.createObjectURL(file),
		revokePreview: (url) => URL.revokeObjectURL(url),
	});
	const selectedFiles = draft.files;
	const previewUrl = draft.previewUrl;
	const isFetchingUrl = draft.fetching;
	const asyncError = draft.error;
	const setAsyncError = draft.setError;
	const [isDragging, setIsDragging] = createSignal(false);
	const [showDiscardDialog, setShowDiscardDialog] = createSignal(false);
	const [submitError, setSubmitError] = createSignal<string | null>(null);
	const [filePickMode, setFilePickMode] = createSignal<"append" | "replace">(
		"replace",
	);
	let fileInputRef: HTMLInputElement | undefined;

	const form = createForm(() => ({
		defaultValues: EMPTY_UPLOAD_FORM,
		validators: { onSubmit: uploadFormSchema },
		onSubmit: async ({ value }) => {
			const epoch = draft.version();
			let files = [...selectedFiles()];
			let filename = value.filename;
			if (files.length === 0 && value.sourceUrl && props.onFetchUrl) {
				try {
					const file = await draft.loadUrl(value.sourceUrl);
					if (!file || !draft.isCurrent(epoch)) return;
					files = [file];
					filename ||= file.name;
				} catch (fetchError) {
					setAsyncError(getErrorMessage(fetchError));
					return;
				}
			}
			if (files.length === 0) {
				setSubmitError(t("uploadMediaModal.thereAreNoFilesToUpload"));
				return;
			}
			filename ||= files[0]?.name ?? "";

			setSubmitError(null);
			setAsyncError(null);
			try {
				const resolution = value.conflictResolution;
				await props.onUploadStart({
					files,
					filename,
					description: value.description,
					sourceUrl: value.sourceUrl || undefined,
					conflictResolution: resolution,
					overwrite: resolution === "overwrite",
					autoIncrement: resolution === "rename",
				});
				if (draft.isCurrent(epoch)) {
					draft.close();
					props.onClose();
				}
			} catch (error) {
				if (!draft.isCurrent(epoch)) return;
				setSubmitError(getErrorMessage(error));
			}
		},
	}));
	const sourceUrl = form.useSelector((state) => state.values.sourceUrl);
	const isSubmitting = form.useSelector((state) => state.isSubmitting);

	const setFiles = (files: File[]) => {
		const previousAutoName = selectedFiles()[0]?.name;
		draft.selectFiles(files);
		setSubmitError(null);
		const filename = form.getFieldValue("filename");
		if (files[0] && (!filename || filename === previousAutoName)) {
			form.setFieldValue("filename", files[0].name);
		} else if (files.length === 0 && filename === previousAutoName) {
			form.setFieldValue("filename", "");
		}
	};

	const appendFiles = (incoming: File[]) => {
		if (incoming.length === 0) return;
		const current = selectedFiles();
		const seen = new Set(
			current.map((file) => `${file.name}\0${file.size}\0${file.lastModified}`),
		);
		const uniqueIncoming = incoming.filter((file) => {
			const key = `${file.name}\0${file.size}\0${file.lastModified}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		if (uniqueIncoming.length > 0) {
			setFiles([...current, ...uniqueIncoming]);
		}
	};

	const removeFileAt = (index: number) => {
		const next = selectedFiles().filter(
			(_, currentIndex) => currentIndex !== index,
		);
		setFiles(next);
	};

	const openFilePicker = (mode: "append" | "replace") => {
		setFilePickMode(mode);
		fileInputRef?.click();
	};

	const handleUrlFetch = async (url: string) => {
		const epoch = draft.version();
		const file = await draft.loadUrl(url);
		if (file && draft.isCurrent(epoch))
			form.setFieldValue("filename", file.name);
	};

	const handleDroppedFiles = (
		files: FileList | null | undefined,
		mode: "append" | "replace",
	) => {
		if (!(files && files.length > 0)) {
			return;
		}
		setAsyncError(null);
		const nextFiles = Array.from(files);
		if (mode === "append" && selectedFiles().length > 0) {
			appendFiles(nextFiles);
		} else {
			setFiles(nextFiles);
		}
	};

	createEffect(
		() => props.isOpen,
		(isOpen) => {
			if (!isOpen) {
				draft.close();
				return;
			}
			const initial = props.initialFiles?.length
				? props.initialFiles
				: props.initialFile
					? [props.initialFile]
					: [];
			draft.open(initial);
			form.reset({
				...EMPTY_UPLOAD_FORM,
				filename: initial[0]?.name ?? "",
				sourceUrl: props.pastedUrl ?? "",
			});
			setSubmitError(null);
			setShowDiscardDialog(false);
		},
	);
	createEffect(
		() => ({
			open: props.isOpen,
			url: sourceUrl(),
			canFetch: Boolean(props.onFetchUrl) && selectedFiles().length === 0,
		}),
		({ open, url, canFetch }) => {
			draft.changeUrl(url);
			if (
				open &&
				canFetch &&
				url &&
				z.url().safeParse(url).success &&
				url !== draft.lastFetchedUrl()
			)
				void handleUrlFetch(url);
		},
	);

	onCleanup(draft.close);

	const requestClose = () => {
		if (isSubmitting()) return false;
		if (form.state.isDirty || selectedFiles().length > 0 || isFetchingUrl()) {
			setShowDiscardDialog(true);
			return false;
		}
		draft.close();
		props.onClose();
		return true;
	};
	const discardAndClose = () => {
		setShowDiscardDialog(false);
		setSubmitError(null);
		draft.close();
		props.onClose();
	};

	return (
		<>
			<Dialog
				onOpenChange={(open, details) => {
					if (!open && !requestClose()) details.cancel();
				}}
				open={props.isOpen}
			>
				<DialogContent
					class="sm:max-w-dialog-md"
					closeDisabled={isSubmitting()}
				>
					<DialogHeader>
						<DialogTitle>{t("uploadMediaModal.uploadMedia")}</DialogTitle>
						<DialogDescription>
							{t("uploadMediaModal.enterDetailsForTheMediaYouWantToUpload")}
						</DialogDescription>
					</DialogHeader>

					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void form.handleSubmit();
						}}
					>
						<div class="grid gap-4 py-4">
							<Show
								when={selectedFiles().length > 0}
								fallback={
									<button
										class={cn(
											"rounded-lg border-2 border-dashed p-6 text-center transition-colors",
											{
												"border-primary bg-primary/5": isDragging(),
												"border-muted": !isDragging(),
											},
										)}
										onClick={() => openFilePicker("replace")}
										onDragEnter={(event) => {
											event.preventDefault();
											setIsDragging(true);
										}}
										onDragLeave={(event) => {
											event.preventDefault();
											if (
												!event.currentTarget.contains(
													event.relatedTarget as Node | null,
												)
											) {
												setIsDragging(false);
											}
										}}
										onDragOver={(event) => event.preventDefault()}
										onDrop={(event) => {
											event.preventDefault();
											setIsDragging(false);
											handleDroppedFiles(event.dataTransfer?.files, "replace");
										}}
										type="button"
									>
										<p class="font-medium text-sm">
											{t("uploadMediaModal.dragAndDropFiles")}
										</p>
										<p class="mt-1 text-muted-foreground text-xs">
											{t("uploadMediaModal.orAddFilesUsingTheFilePicker")}
										</p>
										<span class="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 font-medium text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
											{t("uploadMediaModal.chooseFiles")}
										</span>
									</button>
								}
							>
								<div
									class={cn("rounded-md border p-3 transition-colors", {
										"border-primary bg-primary/5": isDragging(),
									})}
									onDragEnter={(event) => {
										event.preventDefault();
										setIsDragging(true);
									}}
									onDragLeave={(event) => {
										event.preventDefault();
										if (
											!event.currentTarget.contains(
												event.relatedTarget as Node | null,
											)
										) {
											setIsDragging(false);
										}
									}}
									onDragOver={(event) => event.preventDefault()}
									onDrop={(event) => {
										event.preventDefault();
										setIsDragging(false);
										handleDroppedFiles(event.dataTransfer?.files, "append");
									}}
								>
									<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
										<p class="font-medium text-sm">
											{t("uploadMediaModal.selectedFiles")} (
											{selectedFiles().length})
										</p>
										<div class="flex flex-wrap gap-2">
											<Button
												class="min-h-11 sm:min-h-9"
												disabled={isSubmitting()}
												onClick={() => openFilePicker("append")}
												size="sm"
												type="button"
												variant="outline"
											>
												{t("uploadMediaModal.addFiles")}
											</Button>
											<Button
												class="min-h-11 sm:min-h-9"
												disabled={isSubmitting()}
												onClick={() => openFilePicker("replace")}
												size="sm"
												type="button"
												variant="outline"
											>
												{t("uploadMediaModal.changeFiles")}
											</Button>
										</div>
									</div>
									<ul class="max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-1">
										<For each={selectedFiles()}>
											{(file, index) => (
												<li class="flex items-center justify-between gap-2 text-sm">
													<span
														class="min-w-0 flex-1 truncate"
														title={file.name}
													>
														{file.name}
													</span>
													<span class="shrink-0 text-muted-foreground text-xs">
														{fileSizeLabel(file)}
													</span>
													<Button
														aria-label={t("uploadMediaModal.removeFileValue", {
															value0: file.name,
														})}
														class="size-11 shrink-0 sm:size-8"
														disabled={isSubmitting()}
														onClick={() => removeFileAt(index())}
														size="icon"
														type="button"
														variant="ghost"
													>
														<X aria-hidden="true" class="size-4" />
													</Button>
												</li>
											)}
										</For>
									</ul>
								</div>
							</Show>
							<input
								class="hidden"
								multiple
								onChange={(event) => {
									handleDroppedFiles(event.currentTarget.files, filePickMode());
									event.currentTarget.value = "";
								}}
								ref={(element) => {
									fileInputRef = element;
								}}
								type="file"
							/>
							<form.Field name="filename">
								{(field) => (
									<div class="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label class="sm:text-right" for={field().name}>
											{t("uploadMediaModal.filename")}
										</Label>
										<div class="space-y-2 sm:col-span-3">
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(event) =>
													field().handleChange(event.currentTarget.value)
												}
												value={field().state.value}
											/>
											<Show when={selectedFiles().length > 1}>
												<p class="text-muted-foreground text-xs">
													{t("uploadMediaModal.firstFileScopeHint")}
												</p>
											</Show>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="description">
								{(field) => (
									<div class="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label class="sm:text-right" for={field().name}>
											{t("labels.description")}
										</Label>
										<Input
											class="sm:col-span-3"
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(event) =>
												field().handleChange(event.currentTarget.value)
											}
											value={field().state.value}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="sourceUrl">
								{(field) => (
									<div class="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label class="sm:text-right" for={field().name}>
											{t("uploadMediaModal.sourceURL")}
										</Label>
										<div class="relative space-y-2 sm:col-span-3">
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(event) =>
													field().handleChange(event.currentTarget.value)
												}
												value={field().state.value}
											/>
											<Show when={isFetchingUrl()}>
												<div class="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
													{t("status.loading")}
												</div>
											</Show>
											<Show when={selectedFiles().length > 1}>
												<p class="text-muted-foreground text-xs">
													{t("uploadMediaModal.firstFileScopeHint")}
												</p>
											</Show>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
										<Show
											when={
												previewUrl() &&
												selectedFiles()[0]?.type.startsWith("image/")
											}
										>
											<div class="mt-2 flex justify-center sm:col-span-4">
												<img
													alt={t("uploadMediaModal.fetchedPreview")}
													class="max-h-48 rounded-md object-contain"
													src={previewUrl() || undefined}
												/>
											</div>
										</Show>
									</div>
								)}
							</form.Field>

							<form.Field name="conflictResolution">
								{(field) => (
									<div class="space-y-2">
										<Label id="conflict-resolution-label">
											{t("uploadMediaModal.onFilenameConflict")}
										</Label>
										<RadioGroup
											aria-labelledby="conflict-resolution-label"
											class="grid gap-2 sm:grid-cols-3"
											name={field().name}
											onChange={(value) => {
												if (isUploadConflictResolution(value)) {
													field().handleChange(value);
												}
											}}
											value={field().state.value}
										>
											<For each={resolutionOptions}>
												{(option) => (
													<RadioGroupItem
														class="items-start rounded-md border p-3 text-sm data-[checked]:border-primary data-[checked]:bg-primary/5"
														value={option.value}
													>
														<RadioGroupItemLabel class="block cursor-pointer space-y-1 font-normal leading-normal">
															<span class="block font-medium leading-none">
																{option.label}
															</span>
															<span class="block text-muted-foreground text-xs">
																{option.description}
															</span>
														</RadioGroupItemLabel>
													</RadioGroupItem>
												)}
											</For>
										</RadioGroup>
									</div>
								)}
							</form.Field>

							<Show when={(props.conflicts?.length ?? 0) > 0}>
								<Alert variant="warning">
									<AlertTitle>
										{t("uploadMediaModal.aFileWithThisNameAlreadyExists")}
									</AlertTitle>
									<AlertDescription>
										<ul class="mt-2 list-disc space-y-1 pl-5">
											<For each={props.conflicts}>
												{(conflict) => (
													<li>
														{conflict.filename}
														<Show when={conflict.suggestedName}>
															<span> → {conflict.suggestedName}</span>
														</Show>
													</li>
												)}
											</For>
										</ul>
									</AlertDescription>
								</Alert>
							</Show>

							<Show when={props.uploadProgress}>
								{(progress) => (
									<div class="rounded-md border p-3 text-sm">
										<div class="flex justify-between gap-3">
											<span>
												{progress().filename || t("uploadMediaModal.uploading")}
											</span>
											<span class="text-muted-foreground">
												{progress().status ||
													(progress().total
														? t("uploadMediaModal.valueValue", {
																value0: String(progress().current ?? 0),
																value1: String(progress().total),
															})
														: t("uploadMediaModal.processing"))}
											</span>
										</div>
										<div class="mt-2 h-2 overflow-hidden rounded bg-muted">
											<div
												class="upload-progress-fill h-full bg-primary transition-all"
												style={{
													"--upload-progress-width": (() => {
														const total = progress().total;
														return total
															? `${Math.min(100, ((progress().current ?? 0) / total) * 100)}%`
															: "35%";
													})(),
												}}
											/>
										</div>
									</div>
								)}
							</Show>

							<FormError message={asyncError()} />
							<FormError message={submitError()} />
						</div>

						<DialogFooter>
							<Button
								disabled={isSubmitting()}
								onClick={requestClose}
								type="button"
								variant="outline"
							>
								{t("actions.cancel")}
							</Button>
							<form.Subscribe
								selector={(state) => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{(state) => (
									<Button
										aria-busy={state().isSubmitting ? "true" : "false"}
										disabled={
											!state().canSubmit ||
											state().isSubmitting ||
											isFetchingUrl()
										}
										type="submit"
									>
										{state().isSubmitting
											? t("uploadMediaModal.uploading2")
											: t("uploadMediaModal.upload")}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				onOpenChange={setShowDiscardDialog}
				open={showDiscardDialog()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("uploadMediaModal.discardUploadChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("uploadMediaModal.yourSelectedFilesAndInputHaveNotBeenSaved")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={discardAndClose}>
							{t("importReviewModal.discardAndClose")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

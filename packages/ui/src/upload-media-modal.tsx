import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createForm } from "@tanstack/solid-form";
import {
	batch,
	createEffect,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { z } from "zod";
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
	getFormSubmitError,
} from "./form-message";
import { type UploadFormValues, uploadFormSchema } from "./form-schemas";
import { Input } from "./input";
import { Label } from "./label";
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
	pastedUrl: string | null;
	onUploadStart: (options: UploadMediaModalSubmitOptions) => Promise<void>;
	onFetchUrl?: (url: string) => Promise<File>;
	conflicts?: UploadConflict[];
	uploadProgress?: UploadProgress | null;
};

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
				form.setErrorMap({
					onSubmit: {
						form: t("uploadMediaModal.thereAreNoFilesToUpload"),
						fields: {},
					},
				});
				return;
			}
			filename ||= files[0]?.name ?? "";

			form.setErrorMap({ onSubmit: undefined });
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
			} catch (submitError) {
				if (!draft.isCurrent(epoch)) return;
				form.setErrorMap({
					onSubmit: {
						form: getErrorMessage(submitError),
						fields: {},
					},
				});
			}
		},
	}));
	const sourceUrl = form.useSelector((state) => state.values.sourceUrl);

	const setFiles = (files: File[]) => {
		const previousAutoName = selectedFiles()[0]?.name;
		draft.selectFiles(files);
		const filename = form.getFieldValue("filename");
		if (files[0] && (!filename || filename === previousAutoName)) {
			form.setFieldValue("filename", files[0].name);
		}
	};

	const handleUrlFetch = async (url: string) => {
		const epoch = draft.version();
		const file = await draft.loadUrl(url);
		if (file && draft.isCurrent(epoch))
			form.setFieldValue("filename", file.name);
	};

	const handleDroppedFiles = (files: FileList | null | undefined) => {
		if (!(files && files.length > 0)) {
			return;
		}
		setAsyncError(null);
		const nextFiles = Array.from(files);
		setFiles(nextFiles);
	};

	createEffect(
		on(
			() => props.isOpen,
			(isOpen) => {
				if (!isOpen) {
					draft.close();
					return;
				}
				batch(() => {
					draft.open(props.initialFile);
					form.reset({
						...EMPTY_UPLOAD_FORM,
						filename: props.initialFile?.name ?? "",
						sourceUrl: props.pastedUrl ?? "",
					});
					setShowDiscardDialog(false);
				});
			},
		),
	);
	createEffect(
		on(
			() => [props.isOpen, sourceUrl()] as const,
			([open, url]) => {
				draft.changeUrl(url);
				if (
					open &&
					selectedFiles().length === 0 &&
					url &&
					props.onFetchUrl &&
					z.url().safeParse(url).success &&
					url !== draft.lastFetchedUrl()
				)
					void handleUrlFetch(url);
			},
		),
	);

	onCleanup(draft.close);

	const requestClose = () => {
		if (form.state.isDirty || selectedFiles().length > 0 || isFetchingUrl()) {
			setShowDiscardDialog(true);
			return;
		}
		draft.close();
		props.onClose();
	};
	const discardAndClose = () => {
		setShowDiscardDialog(false);
		draft.close();
		props.onClose();
	};

	return (
		<>
			<Dialog
				onOpenChange={(open) => !open && requestClose()}
				open={props.isOpen}
			>
				<Show when={props.isOpen}>
					<DialogContent class="sm:max-w-dialog-md">
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
											class={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
												isDragging()
													? "border-primary bg-primary/5"
													: "border-muted"
											}`}
											onClick={() => fileInputRef?.click()}
											onDragEnter={(event) => {
												event.preventDefault();
												setIsDragging(true);
											}}
											onDragLeave={(event) => {
												event.preventDefault();
												setIsDragging(false);
											}}
											onDragOver={(event) => event.preventDefault()}
											onDrop={(event) => {
												event.preventDefault();
												setIsDragging(false);
												handleDroppedFiles(event.dataTransfer?.files);
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
									<div class="rounded-md border p-3">
										<div class="mb-2 flex items-center justify-between gap-3">
											<p class="font-medium text-sm">
												{t("uploadMediaModal.selectedFiles")}
											</p>
											<Button
												onClick={() => fileInputRef?.click()}
												type="button"
												variant="outline"
											>
												{t("uploadMediaModal.changeFiles")}
											</Button>
										</div>
										<ul class="space-y-2">
											<For each={selectedFiles()}>
												{(file) => (
													<li class="flex items-center justify-between gap-3 text-sm">
														<span class="truncate">{file.name}</span>
														<span class="shrink-0 text-muted-foreground text-xs">
															{fileSizeLabel(file)}
														</span>
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
										handleDroppedFiles(event.currentTarget.files);
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
													aria-invalid={field().state.meta.errors.length > 0}
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(event) =>
														field().handleChange(event.currentTarget.value)
													}
													value={field().state.value}
												/>
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
													aria-invalid={field().state.meta.errors.length > 0}
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
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
											<Show when={previewUrl()}>
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
											<Label>{t("uploadMediaModal.onFilenameConflict")}</Label>
											<div class="grid gap-2 sm:grid-cols-3">
												<For each={resolutionOptions}>
													{(option) => (
														<label class="rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
															<div class="flex items-center gap-2">
																<input
																	checked={field().state.value === option.value}
																	name={field().name}
																	onChange={() =>
																		field().handleChange(option.value)
																	}
																	type="radio"
																/>
																<span class="font-medium">{option.label}</span>
															</div>
															<p class="mt-1 text-muted-foreground text-xs">
																{option.description}
															</p>
														</label>
													)}
												</For>
											</div>
										</div>
									)}
								</form.Field>

								<Show when={(props.conflicts?.length ?? 0) > 0}>
									<div class="rounded-md border border-input bg-warning p-3 text-warning-foreground text-sm">
										<p class="font-medium">
											{t("uploadMediaModal.aFileWithThisNameAlreadyExists")}
										</p>
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
									</div>
								</Show>

								<Show when={props.uploadProgress}>
									{(progress) => (
										<div class="rounded-md border p-3 text-sm">
											<div class="flex justify-between gap-3">
												<span>
													{progress().filename ||
														t("uploadMediaModal.uploading")}
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
								<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
									{(error) => (
										<FormError message={getFormSubmitError(error())} />
									)}
								</form.Subscribe>
							</div>

							<DialogFooter>
								<Button onClick={requestClose} type="button" variant="outline">
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
				</Show>
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

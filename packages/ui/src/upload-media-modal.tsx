import { getErrorMessage } from "@solid-imager/core/utils";
import { createForm } from "@tanstack/solid-form";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { z } from "zod";
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
	onFilesSelected: (files: File[]) => void;
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
		label: "上書き",
		description: "同名ファイルがある場合は既存ファイルを置き換えます。",
	},
	{
		value: "skip",
		label: "スキップ",
		description: "同名ファイルがある場合はアップロードを実行しません。",
	},
	{
		value: "rename",
		label: "リネーム",
		description: "同名ファイルがある場合は連番を付けて保存します。",
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
		return `${file.size} B`;
	}
	if (file.size < 1024 * 1024) {
		return `${(file.size / 1024).toFixed(1)} KB`;
	}
	return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadMediaModalContent(props: UploadMediaModalContentProps) {
	const [selectedFiles, setSelectedFiles] = createSignal<File[]>([]);
	const [isDragging, setIsDragging] = createSignal(false);
	const [isFetchingUrl, setIsFetchingUrl] = createSignal(false);
	const [lastFetchedUrl, setLastFetchedUrl] = createSignal<string | null>(null);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
	const [asyncError, setAsyncError] = createSignal<string | null>(null);
	let fileInputRef: HTMLInputElement | undefined;

	const form = createForm(() => ({
		defaultValues: EMPTY_UPLOAD_FORM,
		validators: { onSubmit: uploadFormSchema },
		onSubmit: async ({ value }) => {
			const files = selectedFiles();
			if (files.length === 0) {
				form.setErrorMap({
					onSubmit: {
						form: "アップロードするファイルがありません。",
						fields: {},
					},
				});
				return;
			}

			form.setErrorMap({ onSubmit: undefined });
			setAsyncError(null);
			try {
				const resolution = value.conflictResolution;
				await props.onUploadStart({
					files,
					filename: value.filename,
					description: value.description,
					sourceUrl: value.sourceUrl || undefined,
					conflictResolution: resolution,
					overwrite: resolution === "overwrite",
					autoIncrement: resolution === "rename",
				});
				props.onClose();
			} catch (submitError) {
				form.setErrorMap({
					onSubmit: {
						form: getErrorMessage(submitError),
						fields: {},
					},
				});
			}
		},
	}));

	const setFiles = (files: File[]) => {
		const previousAutoName = selectedFiles()[0]?.name;
		setSelectedFiles(files);
		props.onFilesSelected(files);
		const filename = form.getFieldValue("filename");
		if (files[0] && (!filename || filename === previousAutoName)) {
			form.setFieldValue("filename", files[0].name);
		}
	};

	const updatePreview = (file: File | null) => {
		const currentPreview = previewUrl();
		if (currentPreview) {
			URL.revokeObjectURL(currentPreview);
			setPreviewUrl(null);
		}
		if (file) {
			setPreviewUrl(URL.createObjectURL(file));
		}
	};

	createEffect(
		on(
			() => props.initialFile,
			(file) => {
				if (file) {
					setSelectedFiles([file]);
					if (!form.getFieldValue("filename")) {
						form.setFieldValue("filename", file.name);
					}
				} else {
					setSelectedFiles([]);
				}
				updatePreview(file);
			},
		),
	);

	createEffect(
		on(
			() => props.pastedUrl,
			(url) => {
				form.setFieldValue("sourceUrl", url || "");
			},
		),
	);

	createEffect(() => {
		const url = form.state.values.sourceUrl;
		if (
			!(url && props.onFetchUrl && z.string().url().safeParse(url).success) ||
			url === lastFetchedUrl()
		) {
			return;
		}
		void handleUrlFetch(url);
	});

	const handleUrlFetch = async (url: string) => {
		if (isFetchingUrl()) {
			return;
		}
		setIsFetchingUrl(true);
		setLastFetchedUrl(url);
		setAsyncError(null);
		try {
			const file = await props.onFetchUrl?.(url);
			if (!file) {
				return;
			}
			form.setFieldValue("filename", file.name);
			setFiles([file]);
			updatePreview(file);
		} catch (fetchError) {
			setAsyncError(getErrorMessage(fetchError));
		} finally {
			setIsFetchingUrl(false);
		}
	};

	const handleDroppedFiles = (files: FileList | null | undefined) => {
		if (!(files && files.length > 0)) {
			return;
		}
		setAsyncError(null);
		const nextFiles = Array.from(files);
		setFiles(nextFiles);
		updatePreview(nextFiles[0] ?? null);
	};

	createEffect(() => {
		if (!props.isOpen) {
			return;
		}
		const initialFiles = props.initialFile ? [props.initialFile] : [];
		setSelectedFiles(initialFiles);
		props.onFilesSelected(initialFiles);
		updatePreview(props.initialFile);
		setLastFetchedUrl(null);
		form.reset({
			...EMPTY_UPLOAD_FORM,
			filename: props.initialFile?.name ?? "",
			sourceUrl: props.pastedUrl ?? "",
		});
		setAsyncError(null);
	});

	onCleanup(() => {
		const currentPreview = previewUrl();
		if (currentPreview) {
			URL.revokeObjectURL(currentPreview);
		}
	});

	return (
		<Dialog onOpenChange={props.onClose} open={props.isOpen}>
			<Show when={props.isOpen}>
				<DialogContent class="sm:max-w-[560px]">
					<DialogHeader>
						<DialogTitle>メディアをアップロード</DialogTitle>
						<DialogDescription>
							アップロードするメディアの詳細を入力してください。
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
							<button
								class={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
									isDragging() ? "border-primary bg-primary/5" : "border-muted"
								}`}
								onClick={() => fileInputRef?.click()}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										fileInputRef?.click();
									}
								}}
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
								<p class="font-medium text-sm">ファイルをドラッグ&ドロップ</p>
								<p class="mt-1 text-muted-foreground text-xs">
									またはファイル選択ダイアログから追加します。
								</p>
								<span class="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 font-medium text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
									ファイルを選択
								</span>
							</button>
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

							<Show when={selectedFiles().length > 0}>
								<div class="rounded-md border p-3">
									<p class="mb-2 font-medium text-sm">選択中のファイル</p>
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

							<form.Field name="filename">
								{(field) => (
									<div class="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label class="sm:text-right" for={field().name}>
											ファイル名
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
											説明
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
											ソースURL
										</Label>
										<div class="relative space-y-2 sm:col-span-3">
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={field().state.meta.errors.length > 0}
												disabled={isFetchingUrl()}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(event) =>
													field().handleChange(event.currentTarget.value)
												}
												value={field().state.value}
											/>
											<Show when={isFetchingUrl()}>
												<div class="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
													Loading...
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
													alt="Fetched preview"
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
										<Label>競合時の処理</Label>
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
								<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm">
									<p class="font-medium">同名ファイルがあります</p>
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
											<span>{progress().filename || "アップロード中"}</span>
											<span class="text-muted-foreground">
												{progress().status ||
													(progress().total
														? `${progress().current ?? 0}/${progress().total}`
														: "処理中")}
											</span>
										</div>
										<div class="mt-2 h-2 overflow-hidden rounded bg-muted">
											<div
												class="h-full bg-primary transition-all"
												style={{
													width: (() => {
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
								{(error) => <FormError message={getFormSubmitError(error())} />}
							</form.Subscribe>
						</div>

						<DialogFooter>
							<Button onClick={props.onClose} type="button" variant="outline">
								キャンセル
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
											? "アップロード中..."
											: "アップロード"}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Show>
		</Dialog>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

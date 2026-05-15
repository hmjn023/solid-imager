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
	const [filename, setFilename] = createSignal("");
	const [description, setDescription] = createSignal("");
	const [sourceUrl, setSourceUrl] = createSignal("");
	const [conflictResolution, setConflictResolution] =
		createSignal<UploadConflictResolution>("skip");
	const [isDragging, setIsDragging] = createSignal(false);
	const [isFetchingUrl, setIsFetchingUrl] = createSignal(false);
	const [lastFetchedUrl, setLastFetchedUrl] = createSignal<string | null>(null);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
	const [error, setError] = createSignal<string | null>(null);
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	let fileInputRef: HTMLInputElement | undefined;

	const setFiles = (files: File[]) => {
		setSelectedFiles(files);
		props.onFilesSelected(files);
		if (files[0] && !filename()) {
			setFilename(files[0].name);
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
					if (!filename()) {
						setFilename(file.name);
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
				setSourceUrl(url || "");
			},
		),
	);

	createEffect(() => {
		const url = sourceUrl();
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
		setError(null);
		try {
			const file = await props.onFetchUrl?.(url);
			if (!file) {
				return;
			}
			setFilename(file.name);
			setFiles([file]);
			updatePreview(file);
		} catch (fetchError) {
			setError((fetchError as Error).message);
		} finally {
			setIsFetchingUrl(false);
		}
	};

	const handleDroppedFiles = (files: FileList | null | undefined) => {
		if (!(files && files.length > 0)) {
			return;
		}
		setError(null);
		const nextFiles = Array.from(files);
		setFiles(nextFiles);
		updatePreview(nextFiles[0] ?? null);
	};

	const handleSubmit = async () => {
		const files = selectedFiles();
		if (files.length === 0) {
			setError("アップロードするファイルがありません。");
			return;
		}

		const resolvedFilename = filename() || files[0]?.name || "";
		if (!resolvedFilename) {
			setError("ファイル名を入力してください。");
			return;
		}

		const resolution = conflictResolution();
		setIsSubmitting(true);
		setError(null);
		try {
			await props.onUploadStart({
				files,
				filename: resolvedFilename,
				description: description(),
				sourceUrl: sourceUrl() || undefined,
				conflictResolution: resolution,
				overwrite: resolution === "overwrite",
				autoIncrement: resolution === "rename",
			});
			props.onClose();
		} catch (submitError) {
			setError((submitError as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	};

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

						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="filename">
								ファイル名
							</Label>
							<Input
								class="col-span-3"
								id="filename"
								onInput={(event) => setFilename(event.currentTarget.value)}
								value={filename()}
							/>
						</div>

						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="description">
								説明
							</Label>
							<Input
								class="col-span-3"
								id="description"
								onInput={(event) => setDescription(event.currentTarget.value)}
								value={description()}
							/>
						</div>

						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="sourceUrl">
								ソースURL
							</Label>
							<div class="relative col-span-3">
								<Input
									disabled={isFetchingUrl()}
									id="sourceUrl"
									onInput={(event) => setSourceUrl(event.currentTarget.value)}
									value={sourceUrl()}
								/>
								<Show when={isFetchingUrl()}>
									<div class="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
										Loading...
									</div>
								</Show>
							</div>
							<Show when={previewUrl()}>
								<div class="col-span-4 mt-2 flex justify-center">
									<img
										alt="Fetched preview"
										class="max-h-48 rounded-md object-contain"
										src={previewUrl() || undefined}
									/>
								</div>
							</Show>
						</div>

						<div class="space-y-2">
							<Label>競合時の処理</Label>
							<div class="grid gap-2 sm:grid-cols-3">
								<For each={resolutionOptions}>
									{(option) => (
										<label class="rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
											<div class="flex items-center gap-2">
												<input
													checked={conflictResolution() === option.value}
													onChange={() => setConflictResolution(option.value)}
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

						<Show when={error()}>
							<p class="text-center text-red-500 text-sm">{error()}</p>
						</Show>
					</div>

					<DialogFooter>
						<Button onClick={props.onClose} type="button" variant="outline">
							キャンセル
						</Button>
						<Button
							disabled={isSubmitting() || isFetchingUrl()}
							onClick={() => void handleSubmit()}
							type="button"
						>
							{isSubmitting() ? "アップロード中..." : "アップロード"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Show>
		</Dialog>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

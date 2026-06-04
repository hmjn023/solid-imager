import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
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

export function UploadMediaModalContent(props: UploadMediaModalContentProps) {
	const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
	const [filename, setFilename] = createSignal("");
	const [description, setDescription] = createSignal("");
	const [sourceUrl, setSourceUrl] = createSignal("");
	const [overwrite, setOverwrite] = createSignal(false);
	const [autoIncrement, setAutoIncrement] = createSignal(false);
	const [isFetchingUrl, setIsFetchingUrl] = createSignal(false);
	const [lastFetchedUrl, setLastFetchedUrl] = createSignal<string | null>(null);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
	const [uploadError, setUploadError] = createSignal<string | null>(null);
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const updateSelectedFile = (file: File | null) => {
		const currentPreview = previewUrl();
		if (currentPreview) {
			URL.revokeObjectURL(currentPreview);
			setPreviewUrl(null);
		}

		setSelectedFile(file);
		props.onFilesSelected(file ? [file] : []);

		if (file) {
			setPreviewUrl(URL.createObjectURL(file));
			if (!filename()) {
				setFilename(file.name);
			}
		}
	};

	createEffect(
		on(
			() => props.initialFile,
			(file) => {
				updateSelectedFile(file);
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

	onCleanup(() => {
		const currentPreview = previewUrl();
		if (currentPreview) {
			URL.revokeObjectURL(currentPreview);
		}
	});

	const handleUrlFetch = async (url: string) => {
		if (isFetchingUrl()) {
			return;
		}

		setIsFetchingUrl(true);
		setLastFetchedUrl(url);
		setUploadError(null);
		try {
			const file = await props.onFetchUrl?.(url);
			if (!file) {
				return;
			}
			setFilename(file.name);
			updateSelectedFile(file);
		} catch (error) {
			setUploadError((error as Error).message);
		} finally {
			setIsFetchingUrl(false);
		}
	};

	const handleSubmit = async () => {
		const file = selectedFile();
		if (!file) {
			setUploadError("アップロードするファイルがありません。");
			return;
		}

		setUploadError(null);
		setIsSubmitting(true);
		try {
			await props.onUploadStart({
				files: [file],
				filename: filename() || file.name,
				description: description(),
				sourceUrl: sourceUrl() || undefined,
				conflictResolution: overwrite()
					? "overwrite"
					: autoIncrement()
						? "rename"
						: "skip",
				overwrite: overwrite(),
				autoIncrement: autoIncrement(),
			});
			props.onClose();
		} catch (error) {
			setUploadError((error as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog onOpenChange={props.onClose} open={props.isOpen}>
			<Show when={props.isOpen}>
				<DialogContent class="sm:max-w-[425px]">
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
							void handleSubmit();
						}}
					>
						<div class="grid gap-4 py-4">
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
								<div class="col-span-3">
									<div class="relative w-full">
										<Input
											class="w-full"
											disabled={isFetchingUrl()}
											id="sourceUrl"
											onInput={(event) =>
												setSourceUrl(event.currentTarget.value)
											}
											value={sourceUrl()}
										/>
										<Show when={isFetchingUrl()}>
											<div class="-translate-y-1/2 absolute top-1/2 right-2 text-sm">
												Loading...
											</div>
										</Show>
									</div>
								</div>
								<Show when={previewUrl()}>
									<div class="col-span-4 mt-2 flex justify-center">
										<img
											alt="Fetched preview"
											class="max-h-48"
											src={previewUrl() || undefined}
										/>
									</div>
								</Show>
							</div>
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right" for="overwrite">
									上書き
								</Label>
								<input
									checked={overwrite()}
									class="col-span-3"
									id="overwrite"
									onChange={(event) =>
										setOverwrite(event.currentTarget.checked)
									}
									type="checkbox"
								/>
							</div>
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right" for="autoIncrement">
									自動連番
								</Label>
								<input
									checked={autoIncrement()}
									class="col-span-3"
									id="autoIncrement"
									onChange={(event) =>
										setAutoIncrement(event.currentTarget.checked)
									}
									type="checkbox"
								/>
							</div>
							<Show when={uploadError()}>
								<p class="col-span-4 text-center text-red-500 text-sm">
									{uploadError()}
								</p>
							</Show>
						</div>
						<DialogFooter>
							<Button
								disabled={isSubmitting() || isFetchingUrl()}
								type="submit"
							>
								{isSubmitting() ? "アップロード中..." : "アップロード"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Show>
		</Dialog>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

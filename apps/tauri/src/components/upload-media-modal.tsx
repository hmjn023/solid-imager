import { uploadMediaFormSchema } from "@solid-imager/core/domain/media/upload-schemas";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { createForm } from "@tanstack/solid-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { z } from "zod";

type UploadMediaModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onUpload: (options: {
		file: File;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	}) => Promise<void>;
	initialFile: File | null;
	onUrlFetch: (file: File) => void;
	pastedUrl: string | null;
};

async function fetchFileFromUrl(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch URL: ${response.status}`);
	}
	const blob = await response.blob();
	return new File(
		[blob],
		url.substring(url.lastIndexOf("/") + 1) || "fetched-image",
		{
			type: blob.type,
		},
	);
}

export function UploadMediaModal(props: UploadMediaModalProps) {
	const [isFetchingUrl, setIsFetchingUrl] = createSignal(false);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
	const [uploadError, setUploadError] = createSignal<string | null>(null);

	const form = createForm(() => ({
		defaultValues: {
			filename: props.initialFile?.name || "",
			description: "",
			sourceUrl: props.pastedUrl || "",
			overwrite: false,
			autoIncrement: false,
		},
		onSubmit: async ({ value }) => {
			if (!props.initialFile) {
				setUploadError("アップロードするファイルがありません。");
				return;
			}
			setUploadError(null);
			try {
				await props.onUpload({
					file: props.initialFile,
					filename: value.filename || props.initialFile.name,
					description: value.description || "",
					sourceUrl: value.sourceUrl || "",
					overwrite: value.overwrite,
					autoIncrement: value.autoIncrement,
				});
				props.onClose();
			} catch (error) {
				setUploadError((error as Error).message);
			}
		},
		validatorAdapter: zodValidator(),
		validators: {
			onChange: uploadMediaFormSchema,
		},
	}));

	createEffect(
		on(
			() => props.initialFile,
			(file) => {
				const currentPreview = previewUrl();
				if (currentPreview) {
					URL.revokeObjectURL(currentPreview);
					setPreviewUrl(null);
				}
				if (file) {
					const objectUrl = URL.createObjectURL(file);
					setPreviewUrl(objectUrl);
					if (!(form.state.isDirty && form.getFieldValue("filename"))) {
						form.setFieldValue("filename", file.name);
					}
				}
			},
		),
	);

	const sourceUrlValue = form.useStore((state) => state.values.sourceUrl);

	createEffect(() => {
		const url = sourceUrlValue();
		if (url && z.string().url().safeParse(url).success) {
			void handleUrlFetch(url);
		}
	});

	const handleUrlFetch = async (url: string) => {
		if (isFetchingUrl()) {
			return;
		}
		const currentPreview = previewUrl();
		if (currentPreview) {
			URL.revokeObjectURL(currentPreview);
			setPreviewUrl(null);
		}
		setIsFetchingUrl(true);
		setUploadError(null);
		try {
			const fetchedFile = await fetchFileFromUrl(url);
			props.onUrlFetch(fetchedFile);
			form.setFieldValue("filename", fetchedFile.name);
			setPreviewUrl(URL.createObjectURL(fetchedFile));
		} catch (error) {
			form.setFieldMeta("sourceUrl", (meta) => ({
				...meta,
				errors: [(error as Error).message],
			}));
		} finally {
			setIsFetchingUrl(false);
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
						void form.handleSubmit();
					}}
				>
					<div class="grid gap-4 py-4">
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="filename">
								ファイル名
							</Label>
							<form.Field name="filename">
								{(field) => (
									<div class="col-span-3">
										<Input
											id="filename"
											onInput={(event) =>
												field().handleChange(event.currentTarget.value)
											}
											value={field().state.value}
										/>
									</div>
								)}
							</form.Field>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="description">
								説明
							</Label>
							<form.Field name="description">
								{(field) => (
									<Input
										class="col-span-3"
										id="description"
										onInput={(event) =>
											field().handleChange(event.currentTarget.value)
										}
										value={field().state.value}
									/>
								)}
							</form.Field>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="sourceUrl">
								ソースURL
							</Label>
							<div class="col-span-3">
								<form.Field name="sourceUrl">
									{(field) => (
										<Input
											disabled={isFetchingUrl()}
											id="sourceUrl"
											onInput={(event) =>
												field().handleChange(event.currentTarget.value)
											}
											value={field().state.value}
										/>
									)}
								</form.Field>
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
							<form.Field name="overwrite">
								{(field) => (
									<input
										checked={field().state.value}
										class="col-span-3 h-4 w-4"
										id="overwrite"
										onChange={(event) =>
											field().handleChange(event.currentTarget.checked)
										}
										type="checkbox"
									/>
								)}
							</form.Field>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="autoIncrement">
								連番回避
							</Label>
							<form.Field name="autoIncrement">
								{(field) => (
									<input
										checked={field().state.value}
										class="col-span-3 h-4 w-4"
										id="autoIncrement"
										onChange={(event) =>
											field().handleChange(event.currentTarget.checked)
										}
										type="checkbox"
									/>
								)}
							</form.Field>
						</div>
						<Show when={uploadError()}>
							<p class="text-red-500 text-sm">{uploadError()}</p>
						</Show>
					</div>
					<DialogFooter>
						<Button onClick={props.onClose} type="button" variant="outline">
							キャンセル
						</Button>
						<Button type="submit">アップロード</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

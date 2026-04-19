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
import { fetchFromUrl } from "~/infrastructure/api-clients/fetch-url-api";

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

function UploadMediaFormContent(props: UploadMediaModalProps) {
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
			} catch (e) {
				setUploadError((e as Error).message);
			}
		},
		validatorAdapter: zodValidator(),
		validators: {
			onChange: uploadMediaFormSchema,
		},
	}));

	// Create preview for initialFile (file selection or image paste)
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
					// Update filename in form if not already set or if it matches the previous file
					// For simplicity, we'll just update it if the form is pristine or empty
					if (!(form.state.isDirty && form.getFieldValue("filename"))) {
						form.setFieldValue("filename", file.name);
					}
				}
			},
		),
	);

	// Watch sourceUrl field for changes to fetch image
	const sourceUrlValue = form.useStore((state) => state.values.sourceUrl);

	createEffect(() => {
		const url = sourceUrlValue();
		// Debounce or check if valid URL before fetching
		if (url && z.string().url().safeParse(url).success) {
			// Avoid re-fetching if same URL (logic can be refined)
			// For now, just fetch if it looks like a new valid URL interaction
			// Ideally we'd have a "Fetch" button or debounce.
			// Replicating previous behavior: fetch on valid URL input.

			// To prevent infinite loops or excessive fetches, we might want to debounce this
			// or only fetch if it changed from previous.
			// Since useStore is reactive, this effect runs on change.

			// Use untracked to check state if needed, but here we just run.
			handleUrlFetch(url);
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
			const blob = await fetchFromUrl(url);
			const fetchedFile = new File(
				[blob],
				url.substring(url.lastIndexOf("/") + 1) || "fetched-image",
				{ type: blob.type },
			);
			props.onUrlFetch(fetchedFile);
			form.setFieldValue("filename", fetchedFile.name);
			setPreviewUrl(URL.createObjectURL(fetchedFile));
		} catch (e) {
			// Form field error could be set here, but we'll use the general error for now
			// or set error on sourceUrl field specifically
			form.setFieldMeta("sourceUrl", (meta) => ({
				...meta,
				errors: [(e as Error).message],
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
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<DialogContent class="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>メディアをアップロード</DialogTitle>
					<DialogDescription>アップロードするメディアの詳細を入力してください。</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
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
											onInput={(e) => field().handleChange(e.target.value)}
											value={field().state.value}
										/>
										<Show when={field().state.meta.errors.length > 0}>
											<p class="text-red-500 text-sm">
												{(field().state.meta.errors[0] as any)?.message ??
													field().state.meta.errors[0]}
											</p>
										</Show>
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
										onInput={(e) => field().handleChange(e.target.value)}
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
								<div class="relative w-full">
									<form.Field name="sourceUrl">
										{(field) => (
											<>
												<Input
													class="w-full"
													disabled={isFetchingUrl()}
													id="sourceUrl"
													onInput={(e) => field().handleChange(e.target.value)}
													value={field().state.value}
												/>
												<Show when={field().state.meta.errors.length > 0}>
													<p class="text-red-500 text-sm">
														{(field().state.meta.errors[0] as any)?.message ??
															field().state.meta.errors[0]}
													</p>
												</Show>
											</>
										)}
									</form.Field>
									<Show when={isFetchingUrl()}>
										<div class="-translate-y-1/2 absolute top-1/2 right-2 text-sm">Loading...</div>
									</Show>
								</div>
							</div>
							<Show when={previewUrl()}>
								<div class="col-span-4 mt-2 flex justify-center">
									<img alt="Fetched preview" class="max-h-48" src={previewUrl() || undefined} />
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
										class="col-span-3"
										id="overwrite"
										onChange={(e) => field().handleChange(e.currentTarget.checked)}
										type="checkbox"
									/>
								)}
							</form.Field>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right" for="autoIncrement">
								自動連番
							</Label>
							<form.Field name="autoIncrement">
								{(field) => (
									<input
										checked={field().state.value}
										class="col-span-3"
										id="autoIncrement"
										onChange={(e) => field().handleChange(e.currentTarget.checked)}
										type="checkbox"
									/>
								)}
							</form.Field>
						</div>
						<Show when={uploadError()}>
							<p class="col-span-4 text-center text-red-500 text-sm">{uploadError()}</p>
						</Show>
					</div>
					<DialogFooter>
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{(state) => (
								<Button
									disabled={!state().canSubmit || state().isSubmitting || isFetchingUrl()}
									type="submit"
								>
									{state().isSubmitting ? "アップロード中..." : "アップロード"}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</div>
	);
}

export function UploadMediaModal(props: UploadMediaModalProps) {
	return (
		<Dialog onOpenChange={props.onClose} open={props.isOpen}>
			<Show when={props.isOpen}>
				<UploadMediaFormContent {...props} />
			</Show>
		</Dialog>
	);
}

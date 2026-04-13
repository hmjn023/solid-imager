import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import {
	createEffect,
	createSignal,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { getTauriAppServices } from "../../app-services";
import { joinLocalPath } from "../../infrastructure/path-utils";

type MediaViewerProps = {
	media: MediaDetails;
	sourceRootPath?: string | null;
};

const MIME_BY_EXTENSION: Record<string, string> = {
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	bmp: "image/bmp",
	svg: "image/svg+xml",
};

function resolveMimeType(fileName: string) {
	const extension = fileName.split(".").pop()?.toLowerCase();
	return (
		(extension && MIME_BY_EXTENSION[extension]) || "application/octet-stream"
	);
}

export function MediaViewer(props: MediaViewerProps) {
	const fileSystem = getTauriAppServices().fileSystem;
	const [mediaUrl, setMediaUrl] = createSignal<string | null>(null);

	createEffect(() => {
		const rootPath = props.sourceRootPath;
		const media = props.media;
		let currentUrl: string | null = null;
		let disposed = false;

		if (!rootPath) {
			setMediaUrl(null);
			return;
		}

		void (async () => {
			try {
				const bytes = await fileSystem.readFile(
					joinLocalPath(rootPath, media.filePath),
				);
				const buffer = new ArrayBuffer(bytes.byteLength);
				new Uint8Array(buffer).set(bytes);
				if (disposed) {
					return;
				}
				currentUrl = URL.createObjectURL(
					new Blob([buffer], { type: resolveMimeType(media.fileName) }),
				);
				setMediaUrl(currentUrl);
			} catch {
				if (!disposed) {
					setMediaUrl(null);
				}
			}
		})();

		onCleanup(() => {
			disposed = true;
			if (currentUrl) {
				URL.revokeObjectURL(currentUrl);
			}
		});
	});

	return (
		<div class="flex h-full w-full items-center justify-center bg-black/5">
			<Switch>
				<Match when={props.media.mediaType === "video"}>
					<Show
						fallback={
							<div class="flex h-full max-h-full w-full items-center justify-center rounded-lg bg-slate-900 text-white">
								Video preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<video class="max-h-full max-w-full" controls src={url()}>
								<track kind="captions" />
							</video>
						)}
					</Show>
				</Match>
				<Match when={props.media.mediaType === "audio"}>
					<Show
						fallback={
							<div class="rounded-lg bg-slate-900 px-8 py-6 text-white">
								Audio preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<audio controls src={url()}>
								<track kind="captions" />
							</audio>
						)}
					</Show>
				</Match>
				<Match when={true}>
					<Show
						fallback={
							<div
								class="flex h-full w-full items-center justify-center rounded-lg border text-white"
								style={{
									background:
										"linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.02)), linear-gradient(135deg, #0f766e, #60a5fa)",
								}}
							>
								<div class="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.35em]">
									{props.media.fileName}
								</div>
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<img
								alt={props.media.fileName}
								class="max-h-full max-w-full object-contain"
								height={props.media.height}
								src={url()}
								width={props.media.width}
							/>
						)}
					</Show>
				</Match>
			</Switch>
		</div>
	);
}

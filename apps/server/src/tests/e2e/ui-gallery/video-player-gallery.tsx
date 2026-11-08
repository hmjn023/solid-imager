import { Button } from "@solid-imager/ui/button";
import { MediaViewer, type MediaSource } from "@solid-imager/ui/media-viewer";
import { createSignal } from "solid-js";

// Generated locally with FFmpeg: four seconds of testsrc2 and a quiet sine tone.
const videoUrl = new URL("./video-player.webm", import.meta.url).href;

export function VideoPlayerGallery() {
	const [source, setSource] = createSignal<MediaSource>({
		type: "video",
		getUrl: () => videoUrl,
	});

	return (
		<main class="workspace-theme flex h-dvh min-w-0 flex-col bg-background text-foreground">
			<header class="flex flex-wrap items-center justify-between gap-2 p-3">
				<h1 class="text-sm font-semibold">Video player fixture</h1>
				<Button
					onClick={() =>
						setSource({
							type: "video",
							getUrl: () => `${videoUrl}?second`,
						})
					}
					variant="outline"
				>
					Switch video
				</Button>
			</header>
			<div class="min-h-0 min-w-0 flex-1">
				<MediaViewer
					fileName="video-player.webm"
					height={180}
					source={source()}
					width={320}
				/>
			</div>
		</main>
	);
}

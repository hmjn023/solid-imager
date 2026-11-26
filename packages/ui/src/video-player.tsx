import { getLocale, t } from "@solid-imager/i18n";
import {
	createEffect,
	createSignal,
	onCleanup,
	onSettled,
	Show,
} from "solid-js";
import { Dynamic } from "@solidjs/web";
import { Button } from "./button";
import { RefreshCw } from "./workspace/icons";

interface VideoPlayerProps {
	src: string;
	fileName: string;
	onError?: () => void;
}

/** Shared playback UI for the Web and Tauri media viewers. */
export function VideoPlayer(props: VideoPlayerProps) {
	const [controlsReady, setControlsReady] = createSignal(false);
	const [isLooping, setIsLooping] = createSignal(true);
	let video: HTMLVideoElement | undefined;
	let loopButton: HTMLButtonElement | undefined;
	let disposed = false;
	const handleLoopKey = (event: KeyboardEvent) => {
		// Preserve native button activation before the controller handles playback hotkeys.
		if (event.key === " " || event.key === "Enter") event.stopPropagation();
	};

	createEffect(
		() => props.src,
		() => {
			setIsLooping(true);
		},
	);

	onSettled(() => {
		let loopObserver: MutationObserver | undefined;
		if (video) {
			const element = video;
			// The browser's context menu can also change this reflected media property.
			loopObserver = new MutationObserver(() => setIsLooping(element.loop));
			loopObserver.observe(element, {
				attributes: true,
				attributeFilter: ["loop"],
			});
		}
		void import("./video-player-elements")
			.then(() => {
				if (!disposed) setControlsReady(true);
			})
			.catch(() => {
				// Keep native controls usable if the optional control UI cannot load.
			});
		return () => loopObserver?.disconnect();
	});

	onCleanup(() => {
		disposed = true;
		loopButton?.removeEventListener("keydown", handleLoopKey);
		loopButton?.removeEventListener("keyup", handleLoopKey);
		video?.pause();
		video?.removeAttribute("src");
		// Reset the resource selection algorithm to cancel a pending native media download.
		video?.load();
	});

	return (
		<Dynamic
			class="video-player"
			component="media-controller"
			defaultstreamtype="on-demand"
			lang={getLocale()}
		>
			<video
				aria-label={props.fileName}
				controls={!controlsReady()}
				loop={isLooping()}
				onError={() => props.onError?.()}
				playsinline
				preload="metadata"
				ref={(element) => {
					video = element;
				}}
				slot="media"
				src={props.src}
			>
				<track kind="captions" />
			</video>
			<Show when={controlsReady()}>
				<div class="video-player-controls" data-media-viewer-controls>
					<Dynamic component="media-time-range" />
					<Dynamic
						aria-label={t("videoPlayer.videoPlaybackControls")}
						component="media-control-bar"
					>
						<Dynamic component="media-play-button" />
						<Dynamic component="media-mute-button" />
						<Dynamic component="media-volume-range" />
						<Dynamic
							component="media-time-display"
							notoggle=""
							showduration=""
						/>
						<span class="video-player-spacer" />
						{/* Solid UI supplies the toggle; Media Chrome's loop button is a menu item. */}
						<Button
							aria-label={t("videoPlayer.toggleVideoLoop")}
							aria-pressed={isLooping()}
							class="video-player-loop"
							onClick={() => setIsLooping((current) => !current)}
							ref={(element) => {
								loopButton = element;
								element.addEventListener("keydown", handleLoopKey);
								element.addEventListener("keyup", handleLoopKey);
							}}
							size="icon"
							title={
								isLooping() ? t("videoPlayer.loopOn") : t("videoPlayer.loopOff")
							}
							variant="ghost"
						>
							<RefreshCw aria-hidden="true" size={20} />
						</Button>
						<Dynamic component="media-playback-rate-button" />
						<Dynamic component="media-pip-button" />
						<Dynamic component="media-fullscreen-button" />
					</Dynamic>
				</div>
			</Show>
		</Dynamic>
	);
}

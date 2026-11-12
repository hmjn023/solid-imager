import { getLocale, t } from "@solid-imager/i18n";
import {
	createEffect,
	createSignal,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "./button";
import { RefreshCw } from "./workspace/icons";

interface VideoPlayerProps {
	src: string;
	fileName: string;
}

/** Shared playback UI for the Web and Tauri media viewers. */
export function VideoPlayer(props: VideoPlayerProps) {
	const [controlsReady, setControlsReady] = createSignal(false);
	const [isLooping, setIsLooping] = createSignal(true);
	let video: HTMLVideoElement | undefined;
	let disposed = false;
	const handleLoopKey = (event: KeyboardEvent) => {
		// Preserve native button activation before the controller handles playback hotkeys.
		if (event.key === " " || event.key === "Enter") event.stopPropagation();
	};

	createEffect(
		on(
			() => props.src,
			() => setIsLooping(true),
		),
	);

	onMount(() => {
		if (video) {
			const element = video;
			// The browser's context menu can also change this reflected media property.
			const loopObserver = new MutationObserver(() =>
				setIsLooping(element.loop),
			);
			loopObserver.observe(element, {
				attributes: true,
				attributeFilter: ["loop"],
			});
			onCleanup(() => loopObserver.disconnect());
		}
		void import("./video-player-elements")
			.then(() => {
				if (!disposed) setControlsReady(true);
			})
			.catch(() => {
				// Keep native controls usable if the optional control UI cannot load.
			});
	});

	onCleanup(() => {
		disposed = true;
		video?.pause();
		video?.removeAttribute("src");
		// Reset the resource selection algorithm to cancel a pending native media download.
		video?.load();
	});

	return (
		<Dynamic
			attr:defaultstreamtype="on-demand"
			class="video-player"
			component="media-controller"
			lang={getLocale()}
		>
			<video
				aria-label={props.fileName}
				controls={!controlsReady()}
				loop={isLooping()}
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
							attr:notoggle=""
							attr:showduration=""
							component="media-time-display"
						/>
						<span class="video-player-spacer" />
						{/* Solid UI supplies the toggle; Media Chrome's loop button is a menu item. */}
						<Button
							aria-label={t("videoPlayer.toggleVideoLoop")}
							aria-pressed={isLooping()}
							class="video-player-loop"
							on:keydown={handleLoopKey}
							on:keyup={handleLoopKey}
							onClick={() => setIsLooping((current) => !current)}
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

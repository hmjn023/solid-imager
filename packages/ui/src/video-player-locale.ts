import { getLocale, t } from "@solid-imager/i18n";
import type { TranslateDictionary } from "media-chrome/dist/lang/en.js";
import { addTranslation, setLanguage } from "media-chrome/dist/utils/i18n.js";

// Register before loading control modules: their tooltip templates are created during evaluation.
const messages = {
	"Start airplay": t("mediaChrome.startAirplayTooltip"),
	"Stop airplay": t("mediaChrome.stopAirplayTooltip"),
	Audio: t("labels.media.audio"),
	Captions: t("mediaChrome.captionsTooltip"),
	"Enable captions": t("mediaChrome.enableCaptionsTooltip"),
	"Disable captions": t("mediaChrome.disableCaptionsTooltip"),
	"Start casting": t("mediaChrome.startCastingTooltip"),
	"Stop casting": t("mediaChrome.stopCastingTooltip"),
	"Enter fullscreen mode": t("mediaChrome.enterFullscreenModeTooltip"),
	"Exit fullscreen mode": t("mediaChrome.exitFullscreenModeTooltip"),
	Mute: t("mediaChrome.muteTooltip"),
	Unmute: t("mediaChrome.unmuteTooltip"),
	Loop: t("mediaChrome.loopTooltip"),
	"Enter picture in picture mode": t(
		"mediaChrome.enterPictureInPictureModeTooltip",
	),
	"Exit picture in picture mode": t(
		"mediaChrome.exitPictureInPictureModeTooltip",
	),
	Play: t("mediaChrome.playTooltip"),
	Pause: t("mediaChrome.pauseTooltip"),
	"Playback rate": t("mediaChrome.playbackRateTooltip"),
	"Playback rate {playbackRate}": t(
		"mediaChrome.playbackRatePlaybackRateTooltip",
		{ playbackRate: "{playbackRate}" },
	),
	Quality: t("mediaChrome.qualityTooltip"),
	"Seek backward": t("mediaChrome.seekBackwardTooltip"),
	"Seek forward": t("mediaChrome.seekForwardTooltip"),
	Settings: t("navigation.settings"),
	Auto: t("mediaChrome.autoTooltip"),
	"audio player": t("mediaChrome.audioPlayer"),
	"video player": t("mediaChrome.videoPlayer"),
	volume: t("mediaChrome.volume"),
	seek: t("mediaChrome.seek"),
	"closed captions": t("mediaChrome.closedCaptions"),
	"current playback rate": t("mediaChrome.currentPlaybackRate"),
	"playback time": t("mediaChrome.playbackTime"),
	"media loading": t("mediaChrome.mediaLoading"),
	settings: t("mediaChrome.settings"),
	"audio tracks": t("mediaChrome.audioTracks"),
	quality: t("mediaChrome.quality"),
	play: t("mediaChrome.play"),
	pause: t("mediaChrome.pause"),
	mute: t("mediaChrome.mute"),
	unmute: t("mediaChrome.unmute"),
	"chapter: {chapterName}": t("mediaChrome.chapter:ChapterName", {
		chapterName: "{chapterName}",
	}),
	live: t("mediaChrome.live"),
	Off: t("mediaChrome.offTooltip"),
	"start airplay": t("mediaChrome.startAirplay"),
	"stop airplay": t("mediaChrome.stopAirplay"),
	"start casting": t("mediaChrome.startCasting"),
	"stop casting": t("mediaChrome.stopCasting"),
	"enter fullscreen mode": t("mediaChrome.enterFullscreenMode"),
	"exit fullscreen mode": t("mediaChrome.exitFullscreenMode"),
	"enter picture in picture mode": t("mediaChrome.enterPictureInPictureMode"),
	"exit picture in picture mode": t("mediaChrome.exitPictureInPictureMode"),
	"seek to live": t("mediaChrome.seekToLive"),
	"playing live": t("mediaChrome.playingLive"),
	"seek back {seekOffset} seconds": t("mediaChrome.seekBackSeekOffsetSeconds", {
		seekOffset: "{seekOffset}",
	}),
	"seek forward {seekOffset} seconds": t(
		"mediaChrome.seekForwardSeekOffsetSeconds",
		{ seekOffset: "{seekOffset}" },
	),
	"Network Error": t("mediaChrome.networkErrorTooltip"),
	"Decode Error": t("mediaChrome.decodeErrorTooltip"),
	"Source Not Supported": t("mediaChrome.sourceNotSupportedTooltip"),
	"Encryption Error": t("mediaChrome.encryptionErrorTooltip"),
	"A network error caused the media download to fail.": t(
		"mediaChrome.aNetworkErrorCausedTheMediaDownloadToFailTooltip",
	),
	"A media error caused playback to be aborted. The media could be corrupt or your browser does not support this format.":
		t(
			"mediaChrome.aMediaErrorCausedPlaybackToBeAbortedTheMediaCouldBeCorruptOrYourBrowserDoesNotSupportThisFormatTooltip",
		),
	"An unsupported error occurred. The server or network failed, or your browser does not support this format.":
		t(
			"mediaChrome.anUnsupportedErrorOccurredTheServerOrNetworkFailedOrYourBrowserDoesNotSupportThisFormatTooltip",
		),
	"The media is encrypted and there are no keys to decrypt it.": t(
		"mediaChrome.theMediaIsEncryptedAndThereAreNoKeysToDecryptItTooltip",
	),
	hour: t("mediaChrome.hour"),
	hours: t("mediaChrome.hours"),
	minute: t("mediaChrome.minute"),
	minutes: t("mediaChrome.minutes"),
	second: t("mediaChrome.second"),
	seconds: t("mediaChrome.seconds"),
	"{time} remaining": t("mediaChrome.timeRemaining", { time: "{time}" }),
	"{currentTime} of {totalTime}": t("mediaChrome.currentTimeOfTotalTime", {
		currentTime: "{currentTime}",
		totalTime: "{totalTime}",
	}),
	"video not loaded, unknown time.": t("mediaChrome.videoNotLoadedUnknownTime"),
} satisfies TranslateDictionary;

addTranslation(getLocale(), messages);
setLanguage(getLocale());

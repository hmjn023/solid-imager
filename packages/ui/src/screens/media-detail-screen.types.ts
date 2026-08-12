import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/domain/sources/events";
import type { Accessor, JSX } from "solid-js";
import type { MediaSourceEventTransport } from "../hooks/use-media-source-events";

export type MediaDetailScreenProps = {
	mediaSourceId: Accessor<string>;
	mediaId: Accessor<string>;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	mediaDetailsQueryOptions: (mediaSourceId: string, mediaId: string) => any;
	sourceRootPath?: string;
	onAdditionalInvalidate?: () => Promise<void>;
	transport: MediaSourceEventTransport;
	renderMediaViewer: (
		media: MediaDetails,
		sourceRootPath?: string,
	) => JSX.Element;
	renderMediaSidebar: (
		media: MediaDetails,
		isUpdating: boolean,
		onUpdate: () => void,
		sourceRootPath?: string,
	) => JSX.Element;
};

export type MediaDetailDataRenderProps = {
	details: MediaDetails;
	isUpdating: boolean;
	onUpdate: () => Promise<void>;
	sourceRootPath?: string;
};

export type MediaDetailEvent =
	| MediaChangedEvent
	| MediaDeletedEvent
	| ThumbnailGeneratedEvent;

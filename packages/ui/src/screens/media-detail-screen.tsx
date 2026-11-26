import { t } from "@solid-imager/i18n";
import { Loading } from "solid-js";
import { MediaDetailLayout } from "../media-detail-layout";
import { MediaDetailSkeleton } from "../media-detail-skeleton";
import { LoadingRegion } from "../skeleton";
import type { MediaDetailScreenProps as MediaDetailScreenBaseProps } from "./media-detail-screen.types";
import { MediaDetailScreenController } from "./media-detail-screen-core";

export { RelatedMedia, type RelatedMediaProps } from "../related-media";

export type MediaDetailScreenProps = MediaDetailScreenBaseProps & {
	renderHeader?: (
		media: Parameters<MediaDetailScreenProps["renderMediaViewer"]>[0],
		isUpdating: import("solid-js").Accessor<boolean>,
		onUpdate: () => void,
		sourceRootPath?: string,
	) => import("@solidjs/web").JSX.Element;
};

export function MediaDetailScreen(props: MediaDetailScreenProps) {
	const renderPending = () => (
		<LoadingRegion
			class="h-full min-h-0"
			label={t("mediaDetailScreen.loadingMediaDetails")}
		>
			<MediaDetailSkeleton />
		</LoadingRegion>
	);
	return (
		<div class="flex h-full min-h-0 w-full flex-col bg-background">
			<Loading fallback={renderPending()}>
				<MediaDetailScreenController
					{...props}
					renderData={(data) => (
						<MediaDetailLayout
							switchDetailsOnMobile
							header={props.renderHeader?.(
								data.details,
								data.isUpdating,
								() => void data.onUpdate(),
								data.sourceRootPath,
							)}
							viewer={props.renderMediaViewer(
								data.details,
								data.sourceRootPath,
							)}
							related={props.renderRelatedMedia?.(data.details)}
							sidebar={props.renderMediaSidebar(
								data.details,
								data.isUpdating,
								() => void data.onUpdate(),
								data.sourceRootPath,
							)}
						/>
					)}
					renderPending={renderPending}
				/>
			</Loading>
		</div>
	);
}

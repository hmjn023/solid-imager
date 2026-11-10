import { Suspense } from "solid-js";
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
	) => import("solid-js").JSX.Element;
};

export function MediaDetailScreen(props: MediaDetailScreenProps) {
	const renderPending = () => (
		<LoadingRegion
			class="h-full min-h-0"
			label="メディア情報を読み込んでいます..."
		>
			<MediaDetailSkeleton />
		</LoadingRegion>
	);
	return (
		<div class="flex h-full min-h-0 w-full flex-col bg-background">
			<Suspense fallback={renderPending()}>
				<MediaDetailScreenController
					{...props}
					renderData={({ details, isUpdating, onUpdate, sourceRootPath }) => (
						<MediaDetailLayout
							header={props.renderHeader?.(
								details,
								isUpdating,
								() => void onUpdate(),
								sourceRootPath,
							)}
							viewer={props.renderMediaViewer(details, sourceRootPath)}
							related={props.renderRelatedMedia?.(details)}
							sidebar={props.renderMediaSidebar(
								details,
								isUpdating,
								() => void onUpdate(),
								sourceRootPath,
							)}
						/>
					)}
					renderPending={renderPending}
				/>
			</Suspense>
		</div>
	);
}

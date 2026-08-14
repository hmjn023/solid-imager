import { LegacyMediaDetailSkeleton } from "../legacy-media-detail-skeleton";
import { LoadingRegion } from "../skeleton";
import type { MediaDetailScreenProps } from "./media-detail-screen.types";
import { MediaDetailScreenController } from "./media-detail-screen-core";

export function LegacyMediaDetailScreen(props: MediaDetailScreenProps) {
	return (
		<div class="mx-auto w-full px-3 py-4 sm:px-4 lg:container lg:p-4">
			<MediaDetailScreenController
				{...props}
				renderData={({ details, isUpdating, onUpdate, sourceRootPath }) => (
					<div class="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:flex-row">
						<div class="min-h-64 min-w-0 overflow-hidden rounded-lg lg:min-h-0 lg:flex-1">
							{props.renderMediaViewer(details, sourceRootPath)}
						</div>
						<div class="min-w-0 shrink-0 lg:w-96 lg:max-w-[40%]">
							{props.renderMediaSidebar(
								details,
								isUpdating,
								() => void onUpdate(),
								sourceRootPath,
							)}
						</div>
					</div>
				)}
				renderPending={() => (
					<LoadingRegion label="メディア情報を読み込んでいます...">
						<LegacyMediaDetailSkeleton />
					</LoadingRegion>
				)}
			/>
		</div>
	);
}

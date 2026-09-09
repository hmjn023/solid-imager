import { MediaDetailSkeleton } from "../media-detail-skeleton";
import { LoadingRegion } from "../skeleton";
import type { MediaDetailScreenProps as MediaDetailScreenBaseProps } from "./media-detail-screen.types";
import { MediaDetailScreenController } from "./media-detail-screen-core";

export type MediaDetailScreenProps = MediaDetailScreenBaseProps & {
	renderHeader?: (
		media: Parameters<MediaDetailScreenProps["renderMediaViewer"]>[0],
		isUpdating: import("solid-js").Accessor<boolean>,
		onUpdate: () => void,
		sourceRootPath?: string,
	) => import("solid-js").JSX.Element;
};

export function MediaDetailScreen(props: MediaDetailScreenProps) {
	return (
		<div class="flex h-full min-h-0 w-full flex-col bg-[var(--workspace-canvas)]">
			<MediaDetailScreenController
				{...props}
				renderData={({ details, isUpdating, onUpdate, sourceRootPath }) => (
					<div class="flex min-h-0 flex-1 flex-col">
						{props.renderHeader?.(
							details,
							isUpdating,
							() => void onUpdate(),
							sourceRootPath,
						)}
						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden [scrollbar-gutter:stable]">
							<div class="min-w-0 lg:min-h-0 lg:overflow-hidden">
								{props.renderMediaViewer(details, sourceRootPath)}
							</div>
							<div class="min-w-0 border-[var(--workspace-border)] border-t lg:min-h-0 lg:border-t-0 lg:border-l">
								{props.renderMediaSidebar(
									details,
									isUpdating,
									() => void onUpdate(),
									sourceRootPath,
								)}
							</div>
						</div>
					</div>
				)}
				renderPending={() => (
					<LoadingRegion
						class="h-full min-h-0"
						label="メディア情報を読み込んでいます..."
					>
						<MediaDetailSkeleton />
					</LoadingRegion>
				)}
			/>
		</div>
	);
}

import type { MediaDetails } from "@solid-imager/core/media";
import { AiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { Button } from "@solid-imager/ui/button";
import { MediaActions } from "@solid-imager/ui/media-actions";
import { OppaiOracleModal } from "@solid-imager/ui/oppai-oracle-modal";
import { SourceMediaGrid } from "@solid-imager/ui/source-media-grid";
import { Toaster } from "@solid-imager/ui/toast";
import { createSignal, For } from "solid-js";

const types = ["image", "video", "audio"] as const;
const media: MediaDetails[] = types.map((mediaType, index) => ({
	id: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
	mediaSourceId: "00000000-0000-4000-8000-000000000010",
	filePath: `/fixture/${mediaType}`,
	fileName: `${mediaType} fixture`,
	mediaType,
	width: 320,
	height: 180,
	fileSize: 1024,
	description: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	modifiedAt: new Date("2026-01-01T00:00:00Z"),
	indexedAt: new Date("2026-01-01T00:00:00Z"),
	status: "active",
	activity: { rating: 0, favorite: false, viewCount: 0, lastViewedAt: null },
	tags: [],
	generationInfo: null,
	authors: [],
	urls: [],
	characters: [],
	ips: [],
}));
const queuedJob = {
	success: true,
	message: "Queued",
	jobId: "00000000-0000-4000-8000-000000000020",
};

export function MediaAiGallery() {
	const initiallyAudio =
		new URLSearchParams(window.location.search).get("type") === "audio";
	const [selected, setSelected] = createSignal(media[initiallyAudio ? 2 : 1]);
	const [lastAction, setLastAction] = createSignal("none");
	const [statusCalls, setStatusCalls] = createSignal(0);
	const record = (action: string) =>
		setLastAction(`${action}:${selected().mediaType}`);

	return (
		<main class="workspace-theme min-h-dvh space-y-4 bg-background p-4 text-foreground">
			<h1 class="text-lg font-semibold">Media AI actions fixture</h1>
			<div class="flex flex-wrap gap-2">
				<For each={media}>
					{(item) => (
						<Button onClick={() => setSelected(item)} variant="outline">
							Select {item.mediaType}
						</Button>
					)}
				</For>
			</div>
			<p>Selected: {selected().mediaType}</p>
			<section aria-label="Media actions">
				<MediaActions
					media={selected()}
					aiTaggingModal={(modalProps) => (
						<AiTaggingModal
							{...modalProps}
							mediaType={selected().mediaType}
							fetchTags={async () => {
								record("tagging");
								return {
									general: { "fixture-tag": 0.9 },
									character: {},
									attributes: {},
									ips: [],
									ips_mapping: {},
								};
							}}
						/>
					)}
					oppaiOracleModal={(modalProps) => (
						<OppaiOracleModal
							{...modalProps}
							mediaType={selected().mediaType}
							fetchTags={async () => {
								record("oppai");
								return { general: {}, rating: {}, tag: {} };
							}}
						/>
					)}
					characterCropModal={() => null}
					getCcipVectorStatus={async () => {
						setStatusCalls((count) => count + 1);
						return { status: "ready" };
					}}
					startCcipExtraction={async () => {
						record("ccip");
						return queuedJob;
					}}
					startEmbeddingExtraction={async () => {
						record("embedding");
						return queuedJob;
					}}
					onFindSimilar={(model = "ccip") => record(`similar:${model}`)}
					onDownload={() => {
						record("download");
					}}
				/>
			</section>
			<output>Last action: {lastAction()}</output>
			<p>CCIP status requests: {statusCalls()}</p>
			<section aria-label="Media collection">
				<SourceMediaGrid
					mediaResults={() => media}
					mediaSourceId={() => media[0].mediaSourceId}
					isFetchingNextPage={false}
					setLoadMoreRef={() => {}}
					state={() => ({
						phase: "data",
						fetchState: "idle",
						data: media,
						error: undefined,
					})}
					onFindSimilar={(item, model) =>
						setLastAction(`grid:${model}:${item.mediaType}`)
					}
					onSyncSingleMedia={() => {}}
					renderItem={(item, options) => (
						<Button
							class="h-24"
							variant="outline"
							data-media-id={item.id}
							onContextMenu={options.onContextMenu}
						>
							{item.fileName}
						</Button>
					)}
				/>
			</section>
			<Toaster />
		</main>
	);
}

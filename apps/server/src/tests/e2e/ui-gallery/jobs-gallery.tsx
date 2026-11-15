import type { JobDto, JobListRequest } from "@solid-imager/core/jobs";
import { Button } from "@solid-imager/ui/button";
import { JobsScreen } from "@solid-imager/ui/screens/jobs";
import { createMemo, createSignal } from "solid-js";

const date = new Date("2026-01-01T00:00:00Z");
const initialJobs: JobDto[] = [
	"batch_ccip_parent",
	"thumbnail_generation_parent",
	"tagging",
].map((type, index) => ({
	id: `00000000-0000-4000-8000-00000000000${index}`,
	type,
	status: "pending",
	createdAt: date,
	updatedAt: date,
	mediaSourceId: null,
	parentId: null,
	error: null,
	cancelRequestedAt: null,
	cancelledAt: null,
	attemptCount: 0,
	startedAt: null,
	finishedAt: null,
	targetMediaId: null,
	targetMediaModifiedAt: null,
	progress: null,
	artifact: null,
}));

export function JobsGallery() {
	const [jobs, setJobs] = createSignal(initialJobs);
	const [refreshing, setRefreshing] = createSignal(false);
	const [status, setStatus] = createSignal<JobListRequest["status"]>();
	const [type, setType] = createSignal<string>();
	const filtered = createMemo(() =>
		jobs().filter(
			(job) =>
				(!type() || job.type === type()) &&
				(!status() ||
					(status() === "active"
						? ["pending", "in_progress"].includes(job.status)
						: job.status === status())),
		),
	);
	const [step, setStep] = createSignal(0);
	const advance = () => {
		const next = step() + 1;
		setStep(next);
		setJobs((current) =>
			current.map((job) => ({
				...job,
				status: next === 3 ? "completed" : "in_progress",
				progress: {
					processed: next === 1 ? 9 : next === 2 ? 999_999 : 1_000_000,
					total: 1_000_000,
					failed: 0,
				},
				targetMediaId: job.id,
				mediaSourceId: job.id,
				targetMediaModifiedAt: date,
				updatedAt: new Date(date.getTime() + next * 1000),
			})),
		);
	};
	return (
		<div class="flex h-dvh min-w-0 flex-col">
			<Button onClick={advance}>Advance jobs</Button>
			<Button onClick={() => setRefreshing(true)}>
				Start background refresh
			</Button>
			<div class="min-h-0 min-w-0 flex-1">
				<JobsScreen
					buildThumbnailUrl={({ mediaId }) => `/job-thumbnail/${mediaId}.webp`}
					jobs={filtered}
					isRefreshing={refreshing}
					onRefresh={() => {}}
					onRetry={() => {}}
					onRetryMany={() => {}}
					onCancel={() => {}}
					onDownload={() => {}}
					status={status}
					onStatusChange={setStatus}
					type={type}
					onTypeChange={setType}
					jobTypes={() => ({
						phase: "data",
						fetchState: "idle",
						error: undefined,
						data: initialJobs.map((job) => job.type),
					})}
					onRetryTypes={() => {}}
					hasMore={() => false}
					isLoadingMore={() => false}
					loadMoreError={() => false}
					onLoadMore={() => {}}

					state={() => ({
						phase: "data",
						fetchState: "idle",
						data: { items: filtered(), total: filtered().length },
						error: undefined,
					})}
				/>
			</div>
		</div>
	);
}

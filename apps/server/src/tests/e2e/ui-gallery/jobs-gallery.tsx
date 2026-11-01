import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { Button } from "@solid-imager/ui/button";
import { JobsScreen } from "@solid-imager/ui/screens/jobs-screen";
import { createSignal } from "solid-js";

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
			<div class="min-h-0 min-w-0 flex-1">
				<JobsScreen
					buildThumbnailUrl={({ mediaId }) => `/job-thumbnail/${mediaId}.webp`}
					jobs={jobs}
					isRefreshing={() => false}
					onRefresh={() => {}}
					onRetry={() => {}}
					onRetryMany={() => {}}
					onCancel={() => {}}
					onDownload={() => {}}
					page={() => ({
						current: 1,
						total: 1,
						canNext: false,
						canPrevious: false,
						onNext: () => {},
						onPrevious: () => {},
					})}
					state={() => ({
						phase: "data",
						fetchState: "idle",
						data: { items: jobs(), total: jobs().length },
						error: undefined,
					})}
				/>
			</div>
		</div>
	);
}

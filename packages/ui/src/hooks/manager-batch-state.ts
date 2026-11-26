import { t } from "@solid-imager/i18n";
import type { JobEvent } from "@solid-imager/core/events";
import type { JobDto, JobStatus } from "@solid-imager/core/jobs";
import { createSynchronousState } from "../utils/synchronous-state";
import type { ManagerBatchRun } from "./manager-batch-run";

export type ManagerBatchContext = Omit<ManagerBatchRun, "jobId">;
export type ManagerBatchTab = ManagerBatchRun["tab"];
type Progress = NonNullable<JobDto["progress"]>;
type Observation = {
	status: JobStatus;
	progress: Progress | null;
	error: string | null;
	readError: string | null;
	version: number;
	attempt: number;
	updatedAt: number;
};
type Request = {
	id: number;
	kind: "scan" | "start";
	context: ManagerBatchContext;
	scanEpoch: number;
};
type ToolDisplay = {
	kind: "scan" | "start" | "run";
	message: string;
	status: JobStatus | null;
	progress: Progress | null;
	jobId: string | null;
};
type ToolView =
	| { kind: "run"; jobId: string }
	| { kind: "scan" | "start"; requestId: number; message: string };

function terminal(status: JobStatus): boolean {
	return status !== "pending" && status !== "in_progress";
}

/** Owns submissions independently of mounted tool panels, and keeps job observations separate from the selected run and scan results. */
export function createManagerBatchState(
	persist: (run: ManagerBatchRun) => void,
) {
	let nextRequestId = 0;
	let selectedRequestId = 0;
	let scanEpoch = 0;
	const requests = createSynchronousState<Request[]>([]);
	const views = createSynchronousState<
		Partial<Record<ManagerBatchTab, ToolView>>
	>({});
	const observations = createSynchronousState<Record<string, Observation>>({});
	const trackedRun = createSynchronousState<ManagerBatchRun | null>(null);

	function rememberRun(run: ManagerBatchRun) {
		if (observations.current()[run.jobId]) return;
		observations.update((previous) => ({
			...previous,
			[run.jobId]: {
				status: "pending",
				progress: null,
				error: null,
				readError: null,
				version: 0,
				attempt: 0,
				updatedAt: 0,
			},
		}));
	}
	function selectRun(run: ManagerBatchRun) {
		rememberRun(run);
		trackedRun.set(run);
		views.update((previous) => ({
			...previous,
			[run.tab]: { kind: "run", jobId: run.jobId },
		}));
		persist(run);
	}
	function begin(
		kind: Request["kind"],
		context: ManagerBatchContext,
	): Request | null {
		if (
			requests.current().some((request) => request.context.tab === context.tab)
		)
			return null;
		const request = {
			id: ++nextRequestId,
			kind,
			context: { ...context },
			scanEpoch,
		};
		requests.update((previous) => [...previous, request]);
		views.update((previous) => ({
			...previous,
			[context.tab]: {
				kind,
				requestId: request.id,
				message:
					kind === "scan" ? t("duplicates.scanning") : t("status.starting"),
			},
		}));
		if (kind === "start") selectedRequestId = request.id;
		return request;
	}
	function finish(request: Request) {
		requests.update((previous) =>
			previous.filter((pending) => pending.id !== request.id),
		);
	}
	function setRequestMessage(request: Request, message: string) {
		const view = views.current()[request.context.tab];
		if (!view || view.kind === "run" || view.requestId !== request.id) return;
		if (request.kind === "scan" && request.scanEpoch !== scanEpoch) return;
		views.update((previous) => ({
			...previous,
			[request.context.tab]: { ...view, message },
		}));
	}
	function acceptStart(request: Request, jobId: string) {
		const run = { ...request.context, jobId };
		rememberRun(run);
		const view = views.current()[run.tab];
		if (view && view.kind !== "run" && view.requestId === request.id)
			views.update((previous) => ({
				...previous,
				[run.tab]: { kind: "run", jobId },
			}));
		// A response may arrive after another tab started or selected a different run.
		if (request.id === selectedRequestId) selectRun(run);
	}
	function observe(event: JobEvent) {
		const id = event.data.jobId;
		if (!id) return;
		const previous = observations.current()[id];
		if (!previous) return;
		let next = { ...previous, version: previous.version + 1 };
		switch (event.event) {
			case "job-progress":
				if (terminal(previous.status)) break;
				next = {
					...next,
					status: "in_progress",
					progress: {
						...previous.progress,
						...event.data,
						failed: event.data.failed ?? previous.progress?.failed ?? 0,
					},
				};
				break;
			case "job-cancellation-requested":
				break;
			case "job-retried":
				next = { ...next, status: "pending", progress: null, error: null };
				break;
			case "job-completed":
				next.status = "completed";
				break;
			case "job-failed":
				next.status = "failed";
				next.error = event.data.error ?? "unknown error";
				break;
			case "job-cancelled":
				next.status = "cancelled";
				break;
			default: {
				const unhandled: never = event;
				throw new Error(
					t("useBatchJobEvents.unhandledJobEventValue", {
						value0: String(String(unhandled)),
					}),
				);
			}
		}
		observations.update((all) => ({ ...all, [id]: next }));
	}
	function acceptSnapshot(job: JobDto, version: number): boolean {
		const previous = observations.current()[job.id];
		if (!previous || previous.version !== version) return false;
		if (
			job.attemptCount < previous.attempt ||
			new Date(job.updatedAt).getTime() < previous.updatedAt
		)
			return false;
		if (
			terminal(previous.status) &&
			!terminal(job.status) &&
			job.attemptCount <= previous.attempt
		)
			return false;
		observations.update((all) => ({
			...all,
			[job.id]: {
				status: job.status,
				progress: job.progress,
				error: job.error,
				readError: null,
				version,
				attempt: job.attemptCount,
				updatedAt: new Date(job.updatedAt).getTime(),
			},
		}));
		return true;
	}
	function display(tab: ManagerBatchTab): ToolDisplay | null {
		const view = views.read()[tab];
		if (!view) return null;
		if (view.kind !== "run")
			return {
				kind: view.kind,
				message: view.message,
				status: null,
				progress: null,
				jobId: null,
			};
		const snapshot = observations.read()[view.jobId];
		if (!snapshot) return null;
		const message =
			snapshot.status === "completed"
				? t("managerBatchState.batchOperationCompletedSuccessfully")
				: snapshot.status === "failed"
					? t("useManagerPage.jobFailedValue", {
							value0: String(
								snapshot.error || t("useManagerPage.unknownError"),
							),
						})
					: snapshot.status === "cancelled"
						? t("managerBatchState.batchOperationCancelled")
						: snapshot.status === "pending"
							? t("managerBatchState.batchOperationQueued")
							: snapshot.progress && snapshot.progress.total > 0
								? t("status.processing")
								: t("managerBatchState.preparingBatchTargets");
		return {
			kind: "run",
			message: snapshot.readError ?? message,
			status: snapshot.status,
			progress: snapshot.progress,
			jobId: view.jobId,
		};
	}
	return {
		begin,
		finish,
		acceptStart,
		setRequestMessage,
		observe,
		acceptSnapshot,
		display,
		trackedRun: trackedRun.read,
		pending: (tab: ManagerBatchTab) =>
			requests.read().find((request) => request.context.tab === tab)?.kind ??
			null,
		version: (id: string) => observations.current()[id]?.version ?? 0,
		failRead: (id: string, message: string) => {
			const previous = observations.current()[id];
			if (previous)
				observations.update((all) => ({
					...all,
					[id]: { ...previous, readError: message },
				}));
		},
		readVersions: () =>
			Object.fromEntries(
				Object.entries(observations.current()).map(([id, observation]) => [
					id,
					observation.version,
				]),
			),
		activeJobId: () => {
			const run = trackedRun.read();
			return run &&
				!terminal(observations.read()[run.jobId]?.status ?? "pending")
				? run.jobId
				: null;
		},
		restore: selectRun,
		select: (run: ManagerBatchRun) => {
			selectedRequestId = ++nextRequestId;
			selectRun(run);
		},
		forget: (jobId: string) => {
			const run = trackedRun.current();
			if (!run || run.jobId !== jobId) return false;
			if (run)
				views.update((previous) => ({
					...previous,
					[run.tab]: {
						kind: "start",
						requestId: -1,
						message: t("managerBatchState.theTrackedBatchNoLongerExists"),
					},
				}));
			trackedRun.set(null);
			return true;
		},
		invalidateScans: () => {
			scanEpoch++;
			views.update((previous) =>
				Object.fromEntries(
					Object.entries(previous).filter(([, view]) => view.kind !== "scan"),
				),
			);
		},
	};
}

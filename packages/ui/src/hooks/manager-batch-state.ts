import type { JobEvent } from "@solid-imager/core/events";
import type { JobDto, JobStatus } from "@solid-imager/core/jobs";
import { createSignal } from "solid-js";
import type { ManagerBatchRun } from "./manager-batch-run";

export type ManagerBatchContext = Omit<ManagerBatchRun, "jobId">;
export type ManagerBatchTab = ManagerBatchRun["tab"];
type Progress = NonNullable<JobDto["progress"]>;
type Observation = {
	status: JobStatus;
	progress: Progress | null;
	error: string | null;
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
	const [requests, setRequests] = createSignal<Request[]>([]);
	const [views, setViews] = createSignal<
		Partial<Record<ManagerBatchTab, ToolView>>
	>({});
	const [observations, setObservations] = createSignal<
		Record<string, Observation>
	>({});
	const [trackedRun, setTrackedRun] = createSignal<ManagerBatchRun | null>(
		null,
	);

	function rememberRun(run: ManagerBatchRun) {
		if (observations()[run.jobId]) return;
		setObservations((previous) => ({
			...previous,
			[run.jobId]: {
				status: "pending",
				progress: null,
				error: null,
				version: 0,
				attempt: 0,
				updatedAt: 0,
			},
		}));
	}
	function selectRun(run: ManagerBatchRun) {
		rememberRun(run);
		setTrackedRun(run);
		setViews((previous) => ({
			...previous,
			[run.tab]: { kind: "run", jobId: run.jobId },
		}));
		persist(run);
	}
	function begin(
		kind: Request["kind"],
		context: ManagerBatchContext,
	): Request | null {
		if (requests().some((request) => request.context.tab === context.tab))
			return null;
		const request = {
			id: ++nextRequestId,
			kind,
			context: { ...context },
			scanEpoch,
		};
		setRequests((previous) => [...previous, request]);
		setViews((previous) => ({
			...previous,
			[context.tab]: {
				kind,
				requestId: request.id,
				message: kind === "scan" ? "Scanning..." : "Starting...",
			},
		}));
		if (kind === "start") selectedRequestId = request.id;
		return request;
	}
	function finish(request: Request) {
		setRequests((previous) =>
			previous.filter((pending) => pending.id !== request.id),
		);
	}
	function setRequestMessage(request: Request, message: string) {
		const view = views()[request.context.tab];
		if (!view || view.kind === "run" || view.requestId !== request.id) return;
		if (request.kind === "scan" && request.scanEpoch !== scanEpoch) return;
		setViews((previous) => ({
			...previous,
			[request.context.tab]: { ...view, message },
		}));
	}
	function acceptStart(request: Request, jobId: string) {
		const run = { ...request.context, jobId };
		rememberRun(run);
		const view = views()[run.tab];
		if (view && view.kind !== "run" && view.requestId === request.id)
			setViews((previous) => ({
				...previous,
				[run.tab]: { kind: "run", jobId },
			}));
		// A response may arrive after another tab started or selected a different run.
		if (request.id === selectedRequestId) selectRun(run);
	}
	function observe(event: JobEvent) {
		const id = event.data.jobId;
		if (!id) return;
		const previous = observations()[id];
		if (!previous) return;
		let next = { ...previous, version: previous.version + 1 };
		switch (event.event) {
			case "job-progress":
				if (terminal(previous.status)) break;
				next = {
					...next,
					status: "in_progress",
					progress: { ...event.data, failed: previous.progress?.failed ?? 0 },
				};
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
		}
		setObservations((all) => ({ ...all, [id]: next }));
	}
	function acceptSnapshot(job: JobDto, version: number): boolean {
		const previous = observations()[job.id];
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
		setObservations((all) => ({
			...all,
			[job.id]: {
				status: job.status,
				progress: job.progress,
				error: job.error,
				version,
				attempt: job.attemptCount,
				updatedAt: new Date(job.updatedAt).getTime(),
			},
		}));
		return true;
	}
	function display(tab: ManagerBatchTab): ToolDisplay | null {
		const view = views()[tab];
		if (!view) return null;
		if (view.kind !== "run")
			return {
				kind: view.kind,
				message: view.message,
				status: null,
				progress: null,
				jobId: null,
			};
		const snapshot = observations()[view.jobId];
		if (!snapshot) return null;
		const message =
			snapshot.status === "completed"
				? "Batch operation completed successfully."
				: snapshot.status === "failed"
					? `Job failed: ${snapshot.error || "unknown error"}`
					: snapshot.status === "cancelled"
						? "Batch operation cancelled."
						: snapshot.status === "pending"
							? "Batch operation queued."
							: snapshot.progress && snapshot.progress.total > 0
								? "Processing..."
								: "Preparing batch targets...";
		return {
			kind: "run",
			message,
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
		trackedRun,
		pending: (tab: ManagerBatchTab) =>
			requests().find((request) => request.context.tab === tab)?.kind ?? null,
		version: (id: string) => observations()[id]?.version ?? 0,
		readVersions: () =>
			Object.fromEntries(
				Object.entries(observations()).map(([id, observation]) => [
					id,
					observation.version,
				]),
			),
		activeJobId: () => {
			const run = trackedRun();
			return run && !terminal(observations()[run.jobId]?.status ?? "pending")
				? run.jobId
				: null;
		},
		restore: selectRun,
		select: (run: ManagerBatchRun) => {
			selectedRequestId = ++nextRequestId;
			selectRun(run);
		},
		forget: () => {
			const run = trackedRun();
			if (run)
				setViews((previous) => ({
					...previous,
					[run.tab]: {
						kind: "start",
						requestId: -1,
						message: "The tracked batch no longer exists.",
					},
				}));
			setTrackedRun(null);
		},
		invalidateScans: () => {
			scanEpoch++;
			setViews((previous) =>
				Object.fromEntries(
					Object.entries(previous).filter(([, view]) => view.kind !== "scan"),
				),
			);
		},
	};
}

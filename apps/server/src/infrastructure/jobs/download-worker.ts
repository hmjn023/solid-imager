import type { IDownloadRunRepository } from "@solid-imager/core/domain/repositories/download-run-repository";
import {
	DownloadCancelledError,
	type DownloadClaim,
	type DownloadRun,
} from "@solid-imager/core/domain/downloads/schemas";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

/** Typed download execution. JobWorker supplies shared general slots; no separate polling queue. */
export class DownloadWorker {
	private readonly controllers = new Set<AbortController>();
	private readonly running = new Set<Promise<void>>();
	private readonly shutdownReason = new Error("Download worker stopped");
	constructor(
		private readonly repo: IDownloadRunRepository,
		private readonly execute: (
			run: DownloadClaim,
			signal: AbortSignal,
		) => Promise<void>,
	) {}
	async claimPending(limit: number) {
		const report = await this.repo.ensureCutover();
		if (report.migrated) logger.info(report, "Legacy downloads migrated");
		return this.repo.claimPending(limit);
	}
	process(run: DownloadClaim) {
		const task = this.executeRun(run);
		this.running.add(task);
		void task.finally(() => this.running.delete(task)).catch(() => {});
		return task;
	}
	async stop() {
		for (const controller of this.controllers)
			controller.abort(this.shutdownReason);
		await Promise.allSettled(this.running);
	}
	private async executeRun(run: DownloadClaim) {
		const controller = new AbortController();
		this.controllers.add(controller);
		let renewing = false;
		const heartbeat = setInterval(() => {
			if (renewing) return;
			renewing = true;
			void this.repo
				.heartbeat(run)
				.then((active) => {
					if (!active) controller.abort(new Error("Download lease ended"));
				})
				.catch((error) => {
					logger.warn(
						{ err: error, runId: run.id },
						"Download heartbeat failed",
					);
					controller.abort(new Error("Download lease could not be renewed"));
				})
				.finally(() => {
					renewing = false;
				});
		}, 30_000);
		try {
			await this.execute(run, controller.signal);
			const settled = await this.repo.settle(run, "completed");
			if (settled) this.publish(settled);
		} catch (error) {
			if (
				controller.signal.aborted &&
				controller.signal.reason === this.shutdownReason
			) {
				const released = await this.repo.release(run);
				if (released) this.publish(released);
				return;
			}
			logger.warn(
				{ err: error, runId: run.id, attemptCount: run.attemptCount },
				"Download execution interrupted",
			);
			const settled = await this.repo.settle(
				run,
				error instanceof DownloadCancelledError ? "cancelled" : "failed",
				error instanceof Error ? error.message : "Download failed",
			);
			if (settled) this.publish(settled);
		} finally {
			clearInterval(heartbeat);
			this.controllers.delete(controller);
		}
	}
	private publish(run: DownloadRun) {
		try {
			if (run.status === "completed")
				RealtimeEventBus.publishJob("job-completed", {
					jobId: run.id,
					message: "Download completed",
				});
			else if (run.status === "cancelled")
				RealtimeEventBus.publishJob("job-cancelled", {
					jobId: run.id,
					message: "Download cancelled",
				});
			else if (run.status === "failed") {
				RealtimeEventBus.publishJob("job-failed", {
					jobId: run.id,
					error: "Download failed",
				});
				if (run.mediaSourceId && run.input)
					RealtimeEventBus.publishSource(run.mediaSourceId, "download-error", {
						url: run.input.targetUrl,
						error: "Download failed",
					});
			}
		} catch (error) {
			logger.warn(
				{ err: error, runId: run.id },
				"Download outcome notification failed",
			);
		}
	}
}

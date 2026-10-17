import type {
	SourceRunClaim,
	SourceRunKind,
} from "@solid-imager/core/domain/source-runs/schemas";
import { SourceRunRepository } from "~/infrastructure/repositories/source-run-repository";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import { logger } from "~/infrastructure/logger";

/** Execution slots belong to JobWorker; this class never starts a second poll loop. */
export class SourceWorker {
	private controllers = new Set<AbortController>();
	private running = new Set<Promise<void>>();
	async claimPending(kinds: SourceRunKind[], limit: number) {
		await sourceRunService.initialize();
		await SourceRunRepository.ensureSyncRuns();
		return SourceRunRepository.claimPending(kinds, limit);
	}
	process(claim: SourceRunClaim) {
		const task = this.execute(claim);
		this.running.add(task);
		void task.finally(() => this.running.delete(task)).catch(() => {});
		return task;
	}
	private async execute(claim: SourceRunClaim) {
		const controller = new AbortController();
		this.controllers.add(controller);
		let renewing = false;
		const heartbeat = setInterval(() => {
			if (renewing) return;
			renewing = true;
			void SourceRunRepository.heartbeat(claim)
				.then((active) => {
					if (!active) controller.abort();
				})
				.catch((err) => {
					logger.warn({ err, runId: claim.id }, "Source lease renewal failed");
					controller.abort();
				})
				.finally(() => {
					renewing = false;
				});
		}, 20_000);
		try {
			await sourceRunService.process(claim, controller.signal);
		} finally {
			clearInterval(heartbeat);
			controller.abort();
			this.controllers.delete(controller);
		}
	}
	cleanup() {
		return sourceRunService.cleanup();
	}
	async stop() {
		for (const controller of this.controllers) controller.abort();
		await Promise.allSettled(this.running);
	}
}

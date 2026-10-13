import type { BatchRunService } from "@solid-imager/application/services/batch-run-service";
import type { IBatchRunRepository } from "@solid-imager/core/domain/repositories/batch-run-repository";
import type { BatchClaim } from "@solid-imager/core/domain/batches/schemas";
/** No inference and no polling loop: JobWorker provides the shared general budget. */
export class BatchWorker {
	constructor(
		private readonly repo: IBatchRunRepository,
		private readonly service: BatchRunService,
	) {}
	async claimPending(limit: number) {
		await this.service.initialize();
		await this.service.reconcile();
		return this.repo.claimPending(limit);
	}
	async process(claim: BatchClaim) {
		await this.service.dispatch(claim);
		await this.service.reconcile();
	}
}

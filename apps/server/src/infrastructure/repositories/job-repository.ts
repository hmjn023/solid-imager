import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { db } from "~/infrastructure/db";

export class JobRepository implements IJobRepository {
	private readonly delegate = createJobRepository(() => db);

	create = this.delegate.create;
	createMany = this.delegate.createMany;
	createIfUnique = this.delegate.createIfUnique;
	findById = this.delegate.findById;
	findPendingImportRequests = this.delegate.findPendingImportRequests;
	findImportRequestsByIds = this.delegate.findImportRequestsByIds;
	findPending = this.delegate.findPending;
	resetInProgressToPending = this.delegate.resetInProgressToPending;
	markImportRequestsCompleted = this.delegate.markImportRequestsCompleted;
	deleteImportRequests = this.delegate.deleteImportRequests;
	markAsInProgress = this.delegate.markAsInProgress;
	markAsCompleted = this.delegate.markAsCompleted;
	markAsFailed = this.delegate.markAsFailed;
	update = this.delegate.update;
	incrementProgress = this.delegate.incrementProgress;
}

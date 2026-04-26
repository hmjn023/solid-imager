type SourceCounter = {
	total: number;
	done: number;
};

export type SourceJobProgressEvents = {
	jobProgress(input: { sourceId: string; processed: number; total: number }): Promise<void> | void;
	allJobsCompleted(input: { sourceId: string; processed: number }): Promise<void> | void;
};

export class SourceJobProgressTracker {
	private readonly counters = new Map<string, SourceCounter>();
	private readonly events: SourceJobProgressEvents;

	constructor(events: SourceJobProgressEvents) {
		this.events = events;
	}

	register(sourceId: string): void {
		const counter = this.counters.get(sourceId) ?? {
			total: 0,
			done: 0,
		};
		counter.total++;
		this.counters.set(sourceId, counter);
	}

	async markDone(sourceId: string): Promise<void> {
		const counter = this.counters.get(sourceId);
		if (!counter) return;

		counter.done++;
		await this.events.jobProgress({
			sourceId,
			processed: counter.done,
			total: counter.total,
		});

		if (counter.done >= counter.total) {
			this.counters.delete(sourceId);
			await this.events.allJobsCompleted({
				sourceId,
				processed: counter.total,
			});
		}
	}
}

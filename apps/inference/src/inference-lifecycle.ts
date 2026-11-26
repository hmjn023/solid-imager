type Model =
	| "tagging"
	| "embedding"
	| "ccip"
	| "ccip-distance"
	| "oppaioracle"
	| "detection"
	| "segmentation";

type Group = {
	model: Model | null;
	ready: Promise<void>;
	finish: () => void;
	users: number;
};

/** Different models and offload barriers take turns, including requests outside JobWorker. */
export class InferenceLifecycle {
	private tail?: Group;
	private epoch = 0;
	get generation() {
		return this.epoch;
	}
	private drained = Promise.resolve();
	private resident: Model | null = null;

	constructor(private readonly release: () => Promise<void>) {}

	async run<T>(model: Model | null, infer: () => Promise<T>): Promise<T> {
		let group = this.tail;
		if (!group || group.model !== model) {
			const ready = this.drained.then(async () => {
				if (this.resident !== null && this.resident !== model) {
					await this.release();
					this.epoch++;
				}
				this.resident = model;
			});
			const completion = Promise.withResolvers<void>();
			group = { model, ready, finish: completion.resolve, users: 0 };
			this.tail = group;
			this.drained = completion.promise;
		}
		group.users++;
		try {
			await group.ready;
			return await infer();
		} finally {
			group.users--;
			if (!group.users) {
				if (this.tail === group) this.tail = undefined;
				group.finish();
			}
		}
	}

	offload(): Promise<void> {
		return this.run(null, async () => {});
	}
}

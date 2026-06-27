import { eventIterator, os } from "@orpc/server";
import {
	type JobEvent,
	jobEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

export const jobsRouter = {
	events: os.output(eventIterator(jobEventSchema)).handler(async function* ({
		signal,
	}) {
		const queue: JobEvent[] = [];
		let resolve: (() => void) | null = null;

		const unsubscribe = RealtimeEventBus.subscribeToJobs((event) => {
			queue.push(event);
			resolve?.();
			resolve = null;
		});

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					await new Promise<void>((done) => {
						const onAbort = () => {
							done();
						};
						signal?.addEventListener("abort", onAbort, { once: true });
						resolve = () => {
							signal?.removeEventListener("abort", onAbort);
							done();
						};
					});
				}

				while (queue.length > 0) {
					const event = queue.shift();
					if (event) {
						yield event;
					}
				}
			}
		} finally {
			unsubscribe();
		}
	}),
};

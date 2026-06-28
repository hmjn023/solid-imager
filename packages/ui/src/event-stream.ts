export type EventStreamFactory<TEvent> = (
	signal: AbortSignal,
) => Promise<AsyncIterable<TEvent>>;

export type EventStreamErrorHandler = (
	error: unknown,
	retryCount: number,
	delay: number,
) => void;

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const onAbort = () => {
			clearTimeout(timer);
			resolve();
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, delay);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export function subscribeToEventStream<TEvent>(
	openStream: EventStreamFactory<TEvent>,
	onEvent: (event: TEvent) => void | Promise<void>,
	onError?: EventStreamErrorHandler,
): () => void {
	const abortController = new AbortController();

	const start = async () => {
		let retryCount = 0;

		while (!abortController.signal.aborted) {
			try {
				const events = await openStream(abortController.signal);

				for await (const event of events) {
					if (abortController.signal.aborted) {
						break;
					}
					retryCount = 0;
					await onEvent(event);
				}

				if (!abortController.signal.aborted) {
					retryCount++;
					const delay = Math.min(
						INITIAL_RETRY_DELAY * 2 ** (retryCount - 1),
						MAX_RETRY_DELAY,
					);
					await waitForRetry(delay, abortController.signal);
				}
			} catch (error) {
				if (abortController.signal.aborted) {
					break;
				}

				retryCount++;
				const delay = Math.min(
					INITIAL_RETRY_DELAY * 2 ** (retryCount - 1),
					MAX_RETRY_DELAY,
				);
				try {
					onError?.(error, retryCount, delay);
				} catch (handlerError) {
					console.error(
						"[subscribeToEventStream] Error handler failed:",
						handlerError,
					);
				}
				await waitForRetry(delay, abortController.signal);
			}
		}
	};

	void start();

	return () => {
		abortController.abort();
	};
}

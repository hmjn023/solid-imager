import type { JobEvent } from "@solid-imager/core/events";
import { QueryClient, QueryObserver } from "@tanstack/solid-query";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { jobsQueryKeys } from "../query-options/jobs-query";
import { useJobsQueryEvents } from "./use-jobs-query-events";

const mocks = vi.hoisted(() => ({ client: vi.fn(), subscribe: vi.fn() }));
vi.mock("@tanstack/solid-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/solid-query")>()),
	useQueryClient: mocks.client,
}));
vi.mock("./use-job-events", () => ({ useJobEvents: mocks.subscribe }));

function setup() {
	const client = new QueryClient();
	mocks.client.mockReturnValue(client);
	const invalidate = vi.spyOn(client, "invalidateQueries");
	let receive!: (event: JobEvent) => void;
	mocks.subscribe.mockImplementation((_stream, callback) => {
		receive = callback;
	});
	const dispose = createRoot((dispose) => {
		useJobsQueryEvents(vi.fn());
		return dispose;
	});
	return { client, receive, invalidate, dispose };
}

describe("job list event refreshes", () => {
	it.each(["job-completed", "job-failed", "job-cancelled"] as const)(
		"does not refetch lists for an internal import %s event, including replay",
		async (event) => {
			const { receive, invalidate, dispose } = setup();
			try {
				const notification: JobEvent = {
					event,
					data: {
						jobId: "child",
						importBatchId: "00000000-0000-4000-8000-000000000001",
					},
				};
				receive(notification);
				receive(notification);
				await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
				for (const [filters] of invalidate.mock.calls)
					expect(filters?.queryKey).toEqual(jobsQueryKeys.detail("child"));
			} finally {
				dispose();
			}
		},
	);
	it("refreshes the list when a batch is queued and when the parent finishes", async () => {
		const { receive, invalidate, dispose } = setup();
		try {
			receive({
				event: "job-progress",
				data: { jobId: "batch", created: true, total: 100, processed: 0 },
			});
			await vi.waitFor(() =>
				expect(invalidate).toHaveBeenCalledWith(
					{ queryKey: jobsQueryKeys.all() },
					{ cancelRefetch: false },
				),
			);
			invalidate.mockClear();
			receive({
				event: "job-progress",
				data: { jobId: "batch", total: 100, processed: 1 },
			});
			expect(invalidate).toHaveBeenCalledWith(
				{ queryKey: jobsQueryKeys.targets("batch") },
				{ cancelRefetch: false },
			);
			invalidate.mockClear();
			receive({ event: "job-completed", data: { jobId: "batch" } });
			await vi.waitFor(() =>
				expect(invalidate).toHaveBeenCalledWith(
					{ queryKey: jobsQueryKeys.all() },
					{ cancelRefetch: false },
				),
			);
		} finally {
			dispose();
		}
	});
});

it.each([false, true])(
	"refreshes a terminal child after an in-flight read (cached: %s)",
	async (cached) => {
		const { client, receive, dispose } = setup();
		const key = jobsQueryKeys.detail("child");
		if (cached) client.setQueryData(key, "in_progress");
		let release!: (value: string) => void;
		const pending = new Promise<string>((resolve) => {
			release = resolve;
		});
		const queryFn = vi
			.fn()
			.mockReturnValueOnce(pending)
			.mockResolvedValue("completed");
		const observer = new QueryObserver(client, { queryKey: key, queryFn });
		const unsubscribe = observer.subscribe(() => {});
		try {
			receive({
				event: "job-completed",
				data: {
					jobId: "child",
					importBatchId: "00000000-0000-4000-8000-000000000001",
				},
			});
			release("in_progress");
			await vi.waitFor(() =>
				expect(client.getQueryData(key)).toBe("completed"),
			);
			expect(queryFn).toHaveBeenCalledTimes(2);
		} finally {
			unsubscribe();
			dispose();
			client.clear();
		}
	},
);

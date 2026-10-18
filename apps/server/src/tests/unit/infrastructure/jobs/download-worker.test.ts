import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DownloadWorker } from "~/infrastructure/jobs/download-worker";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import type { IDownloadRunRepository } from "@solid-imager/core/domain/repositories/download-run-repository";
import type {
	DownloadClaim,
	DownloadRun,
} from "@solid-imager/core/domain/downloads/schemas";

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishJob: vi.fn(), publishSource: vi.fn() },
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn() },
}));
describe("typed download execution", () => {
	const run = {
		id: "11111111-1111-4111-8111-111111111111",
		mediaSourceId: "22222222-2222-4222-8222-222222222222",
		attemptCount: 1,
		input: {
			targetUrl: "https://example.invalid/image",
			cookies: [{ value: "private-cookie" }],
		},
	} as DownloadClaim;
	let repo: IDownloadRunRepository;
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		repo = {
			ensureCutover: vi.fn().mockResolvedValue({ migrated: 0 }),
			claimPending: vi.fn().mockResolvedValue([]),
			heartbeat: vi.fn().mockResolvedValue(true),
			release: vi.fn().mockResolvedValue({ ...run, status: "pending" }),
			settle: vi.fn().mockResolvedValue({ ...run, status: "completed" }),
		} as unknown as IDownloadRunRepository;
	});
	afterEach(() => {
		vi.useRealTimers();
	});
	it.each([false, true])(
		"aborts and releases a download during stop, including a late claim: %s",
		async (late) => {
			const pending = Promise.withResolvers<DownloadClaim[]>();
			vi.mocked(repo.claimPending).mockImplementationOnce(
				() => pending.promise,
			);
			let activeSignal: AbortSignal | undefined;
			const downloads = new DownloadWorker(repo, async (_run, signal) => {
				activeSignal = signal;
				await new Promise<void>((_resolve, reject) =>
					signal.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					}),
				);
			});
			const coordinator = new JobWorker(
				downloads,
				{ claimPending: vi.fn().mockResolvedValue([]), process: vi.fn() },
				{
					claimPending: vi.fn().mockResolvedValue([]),
					process: vi.fn(),
					cleanup: vi.fn().mockResolvedValue(undefined),
					stop: vi.fn().mockResolvedValue(undefined),
				},
			);
			coordinator.updateConfig({
				...defaultAppConfig,
				jobs: { ...defaultAppConfig.jobs, concurrency: 1, pollIntervalMs: 100 },
			});
			coordinator.start();
			await vi.advanceTimersByTimeAsync(0);
			if (!late) {
				pending.resolve([run]);
				await vi.advanceTimersByTimeAsync(0);
			}
			const stopping = coordinator.stop();
			if (late) pending.resolve([run]);
			await stopping;
			expect(activeSignal?.aborted).toBe(true);
			expect(repo.release).toHaveBeenCalledExactlyOnceWith(run);
			expect(repo.settle).not.toHaveBeenCalled();
			expect(RealtimeEventBus.publishJob).not.toHaveBeenCalled();
			const count = vi.mocked(repo.heartbeat).mock.calls.length;
			await vi.advanceTimersByTimeAsync(60_000);
			expect(repo.heartbeat).toHaveBeenCalledTimes(count);
		},
	);
	it("publishes failure once, only after settlement, without raw paths or authentication", async () => {
		const failure = {
			...run,
			status: "failed",
			error: "/private/server/path private-cookie",
		} as DownloadRun;
		vi.mocked(repo.settle).mockImplementation(async () => {
			expect(RealtimeEventBus.publishSource).not.toHaveBeenCalled();
			return failure;
		});
		await new DownloadWorker(repo, async () => {
			throw new Error("private filesystem path");
		}).process(run);
		expect(RealtimeEventBus.publishJob).toHaveBeenCalledOnce();
		expect(RealtimeEventBus.publishSource).toHaveBeenCalledOnce();
		expect(
			JSON.stringify(vi.mocked(RealtimeEventBus.publishSource).mock.calls),
		).not.toMatch(/private-cookie|private\/server|filesystem/);
	});
	it("aborts work when heartbeat loses ownership and never publishes a stale outcome", async () => {
		vi.mocked(repo.heartbeat).mockResolvedValue(false);
		vi.mocked(repo.settle).mockResolvedValue(null);
		let activeSignal: AbortSignal | undefined;
		const worker = new DownloadWorker(repo, async (_run, signal) => {
			activeSignal = signal;
			await new Promise<void>((_resolve, reject) =>
				signal.addEventListener("abort", () => reject(signal.reason), {
					once: true,
				}),
			);
		});
		const processing = worker.process(run);
		await vi.advanceTimersByTimeAsync(30_000);
		await processing;
		expect(activeSignal?.aborted).toBe(true);
		expect(RealtimeEventBus.publishJob).not.toHaveBeenCalled();
		expect(RealtimeEventBus.publishSource).not.toHaveBeenCalled();
	});
	it("publishes the cancellation that won a completion race", async () => {
		vi.mocked(repo.settle).mockResolvedValue({
			...run,
			status: "cancelled",
		} as DownloadRun);
		await new DownloadWorker(repo, async () => undefined).process(run);
		expect(RealtimeEventBus.publishJob).toHaveBeenCalledWith(
			"job-cancelled",
			expect.objectContaining({ jobId: run.id }),
		);
		expect(RealtimeEventBus.publishSource).not.toHaveBeenCalled();
	});
	it("does not turn a committed outcome into failure when notification throws", async () => {
		vi.mocked(RealtimeEventBus.publishJob).mockImplementationOnce(() => {
			throw new Error("listener");
		});
		await expect(
			new DownloadWorker(repo, async () => undefined).process(run),
		).resolves.toBeUndefined();
		expect(repo.settle).toHaveBeenCalledOnce();
		expect(repo.settle).toHaveBeenCalledWith(run, "completed");
	});
});

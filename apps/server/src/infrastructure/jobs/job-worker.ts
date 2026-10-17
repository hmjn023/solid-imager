import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { DownloadClaim } from "@solid-imager/core/domain/downloads/schemas";
import type { BatchClaim } from "@solid-imager/core/domain/batches/schemas";
import type { SourceRunClaim } from "@solid-imager/core/domain/source-runs/schemas";
import type { DownloadWorker } from "./download-worker";
import type { BatchWorker } from "./batch-worker";
import type { SourceWorker } from "./source-worker";
import { logger } from "~/infrastructure/logger";

/** Coordinates typed flows only. MediaFileWorker/MediaAiWorker own all computation. */
export class JobWorker {
	private running = false;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private cleanupTimer: ReturnType<typeof setInterval> | undefined;
	private polling: Promise<void> | undefined;
	private cleaning: Promise<void> | undefined;
	private tasks = new Set<Promise<void>>();
	private activeGeneral = 0;
	private activeExport = 0;
	private concurrency = 3;
	private interval = 1000;
	private first = 0;
	private requested = false;
	constructor(
		private readonly downloads: Pick<
			DownloadWorker,
			"claimPending" | "process"
		>,
		private readonly batches: Pick<BatchWorker, "claimPending" | "process">,
		private readonly sources: Pick<
			SourceWorker,
			"claimPending" | "process" | "cleanup" | "stop"
		>,
	) {}
	updateConfig(config: AppConfig) {
		this.concurrency = config.jobs.concurrency;
		this.interval = config.jobs.pollIntervalMs;
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.cleanup();
		this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
		this.tick();
	}
	async stop() {
		this.running = false;
		if (this.timer) clearTimeout(this.timer);
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);
		this.timer = undefined;
		this.cleanupTimer = undefined;
		const aborting = this.sources.stop();
		await this.polling;
		await aborting;
		await this.sources.stop();
		await Promise.allSettled(this.tasks);
		await this.cleaning;
	}
	private cleanup() {
		if (this.cleaning) return;
		this.cleaning = this.sources
			.cleanup()
			.catch((err) => logger.error({ err }, "Source retention cleanup failed"))
			.finally(() => {
				this.cleaning = undefined;
			});
	}
	private schedule(delay: number) {
		if (!this.running) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.tick();
		}, delay);
	}
	private tick() {
		if (!this.running || this.polling) return;
		this.requested = false;
		this.polling = this.poll()
			.catch((err) => logger.error({ err }, "Typed flow claim failed"))
			.finally(() => {
				this.polling = undefined;
				this.schedule(this.requested ? 0 : this.interval);
			});
	}
	private launch(
		claim: DownloadClaim | BatchClaim | SourceRunClaim,
		pool: "general" | "export",
		execute: () => Promise<void>,
	) {
		if (pool === "general") this.activeGeneral++;
		else this.activeExport++;
		const task = Promise.resolve()
			.then(execute)
			.catch((err) =>
				logger.error({ err, runId: claim.id }, "Typed flow execution failed"),
			)
			.finally(() => {
				if (pool === "general") this.activeGeneral--;
				else this.activeExport--;
				this.tasks.delete(task);
				this.requested = true;
				if (!this.polling) this.schedule(0);
			});
		this.tasks.add(task);
	}
	private async poll() {
		await this.batches.claimPending(0);
		if (this.activeExport < 1)
			for (const claim of await this.sources.claimPending(["export"], 1))
				this.launch(claim, "export", () => this.sources.process(claim));
		const order = ["download", "batch", "source"] as const;
		const first = this.first;
		for (let offset = 0; offset < order.length; offset++) {
			if (!this.running) break;
			const slots = Math.max(0, this.concurrency - this.activeGeneral);
			if (!slots) break;
			const index = (first + offset) % order.length;
			const before = this.activeGeneral;
			switch (order[index]) {
				case "download":
					for (const claim of await this.downloads.claimPending(slots))
						this.launch(claim, "general", () => this.downloads.process(claim));
					break;
				case "batch":
					for (const claim of await this.batches.claimPending(slots))
						this.launch(claim, "general", () => this.batches.process(claim));
					break;
				case "source":
					for (const claim of await this.sources.claimPending(
						["sync", "restore"],
						slots,
					))
						this.launch(claim, "general", () => this.sources.process(claim));
					break;
			}
			if (this.activeGeneral > before) this.first = (index + 1) % order.length;
		}
	}
}

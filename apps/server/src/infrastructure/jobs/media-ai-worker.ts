import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { AiTaskKind } from "@solid-imager/core/domain/processing/schemas";
import { logger } from "~/infrastructure/logger";

type RunTask = (
	kind: AiTaskKind,
) => Promise<"idle" | "completed" | "retry" | "failed" | "superseded">;
/** Shared tagging/CCIP inference budget, independent of generic observer jobs. */
export class MediaAiWorker {
	private running = false;
	private concurrency = 1;
	private pollIntervalMs = 1000;
	private slots = 0;
	private nextKind: AiTaskKind = "tagging";
	private readonly loops: Promise<void>[] = [];
	private readonly wakeups = new Set<() => void>();
	constructor(private readonly runTask: RunTask) {}
	updateConfig(config: AppConfig) {
		this.concurrency = config.jobs.aiConcurrency;
		this.pollIntervalMs = config.jobs.pollIntervalMs;
		if (this.running) this.addSlots();
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.addSlots();
	}
	private addSlots() {
		while (this.slots < this.concurrency)
			this.loops.push(this.loop(this.slots++));
	}
	async stop() {
		this.running = false;
		for (const wake of this.wakeups) wake();
		await Promise.all(this.loops);
		this.loops.length = 0;
		this.slots = 0;
	}
	private pause() {
		return new Promise<void>((resolve) => {
			const wake = () => {
				clearTimeout(timer);
				this.wakeups.delete(wake);
				resolve();
			};
			const timer = setTimeout(wake, this.pollIntervalMs);
			this.wakeups.add(wake);
		});
	}
	private async loop(slot: number) {
		while (this.running) {
			try {
				if (slot >= this.concurrency) {
					await this.pause();
					continue;
				}
				const kind = this.nextKind;
				this.nextKind = kind === "tagging" ? "ccip" : "tagging";
				const result = await this.runTask(kind);
				if (this.running && result === "idle") {
					const other = kind === "tagging" ? "ccip" : "tagging";
					if (slot < this.concurrency && (await this.runTask(other)) !== "idle")
						continue;
					if (this.running) await this.pause();
				}
			} catch (err) {
				logger.error({ err }, "AI processing worker failed");
				if (this.running) await this.pause();
			}
		}
	}
}

import type { IMediaProcessingService } from "@solid-imager/application/ports/media-processing-service";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { FileTaskKind } from "@solid-imager/core/domain/processing/schemas";
import { logger } from "~/infrastructure/logger";

/** Independent file pools. Generic job attempts never own file output. */
export class MediaFileWorker {
	private running = false;
	private concurrency = 3;
	private pollIntervalMs = 1000;
	private metadataSlots = 0;
	private readonly loops: Promise<void>[] = [];
	private readonly wakeups = new Set<() => void>();
	constructor(
		private readonly processing: Pick<IMediaProcessingService, "runFileTask">,
	) {}
	updateConfig(config: AppConfig) {
		this.concurrency = config.jobs.concurrency;
		this.pollIntervalMs = config.jobs.pollIntervalMs;
		if (this.running) this.addMetadataSlots();
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.addMetadataSlots();
		this.loops.push(this.loop("thumbnail", 0));
	}
	private addMetadataSlots() {
		while (this.metadataSlots < this.concurrency) {
			this.loops.push(this.loop("metadata", this.metadataSlots++));
		}
	}
	async stop() {
		this.running = false;
		for (const wake of this.wakeups) wake();
		await Promise.all(this.loops);
		this.loops.length = 0;
		this.metadataSlots = 0;
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
	private async loop(kind: FileTaskKind, slot: number) {
		while (this.running) {
			try {
				if (kind === "metadata" && slot >= this.concurrency) {
					await this.pause();
					continue;
				}
				const result = await this.processing.runFileTask(kind);
				if (this.running && result === "idle") await this.pause();
			} catch (err) {
				logger.error({ err, kind }, "File processing worker failed");
				if (this.running) await this.pause();
			}
		}
	}
}

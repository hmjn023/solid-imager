import {
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DownloadRegistrationEntry } from "@solid-imager/core/domain/jobs/schemas";
import type { IDownloadRunRepository } from "@solid-imager/core/domain/repositories/download-run-repository";
import type { DownloadClaim } from "@solid-imager/core/domain/downloads/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadRegistration } from "~/infrastructure/jobs/download-registration";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishSource: vi.fn() },
}));
vi.mock("~/infrastructure/logger", () => ({ logger: { warn: vi.fn() } }));

describe("durable download registration", () => {
	let base: string;
	let job: DownloadClaim;
	let saved: DownloadClaim;
	let repo: IDownloadRunRepository;
	let handoff: DownloadRegistration;
	const register = vi.fn();
	const resume = () =>
		new DownloadRegistration(saved, "source", base, repo, register).resume();
	beforeEach(async () => {
		vi.resetAllMocks();
		base = await mkdtemp(path.join(tmpdir(), "download-registration-"));
		job = {
			id: "download-job",
			attemptCount: 1,
			input: { targetUrl: "https://example.com/image" },
			checkpoint: null,
		} as DownloadClaim;
		saved = structuredClone(job);
		repo = {
			withActiveClaim: vi.fn(async (_claim, action) => action(undefined)),
			saveCheckpoint: vi.fn(async (_claim, checkpoint) => {
				saved = JSON.parse(JSON.stringify({ ...saved, checkpoint }));
			}),
		} as unknown as IDownloadRunRepository;
		register.mockImplementation(async (entry) => ({
			id: "22222222-2222-4222-8222-222222222222",
			filePath: entry.filePath,
		}));
		handoff = new DownloadRegistration(job, "source", base, repo, register);
		await handoff.prepare();
	});
	afterEach(async () => {
		await rm(base, { recursive: true, force: true });
	});
	async function entry(name = "image.png"): Promise<DownloadRegistrationEntry> {
		const stagedPath = path.join(handoff.stagingDirectory, name);
		await writeFile(stagedPath, "completed download");
		const file = await stat(stagedPath);
		return {
			stagedPath,
			filePath: name,
			fileSize: file.size,
			modifiedAt: file.mtime,
			published: false,
			context: {
				sourceUrls: ["https://example.com/image", "https://example.com/post"],
			},
		};
	}
	it("persists recovery information before publishing a completed file", async () => {
		const prepared = await entry();
		vi.mocked(repo.saveCheckpoint).mockImplementationOnce(
			async (_claim, checkpoint) => {
				await expect(
					stat(path.join(base, prepared.filePath)),
				).rejects.toMatchObject({ code: "ENOENT" });
				saved = JSON.parse(JSON.stringify({ ...saved, checkpoint }));
			},
		);
		register.mockImplementationOnce(async (item) => {
			expect(await readFile(path.join(base, item.filePath), "utf8")).toBe(
				"completed download",
			);
			expect(saved.checkpoint).toMatchObject({
				entries: [{ context: { sourceUrls: prepared.context.sourceUrls } }],
			});
			return {
				id: "22222222-2222-4222-8222-222222222222",
				filePath: item.filePath,
			};
		});
		await handoff.complete([prepared]);
		expect(RealtimeEventBus.publishSource).toHaveBeenCalledOnce();
		await expect(stat(handoff.stagingDirectory)).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(await resume()).toBe(true);
	});
	it("keeps files hidden when saving the recovery checkpoint fails", async () => {
		const prepared = await entry();
		vi.mocked(repo.saveCheckpoint).mockRejectedValueOnce(
			new Error("checkpoint failed"),
		);
		await expect(handoff.complete([prepared])).rejects.toThrow(
			"checkpoint failed",
		);
		await expect(
			stat(path.join(base, prepared.filePath)),
		).rejects.toMatchObject({ code: "ENOENT" });
		expect(register).not.toHaveBeenCalled();
	});
	it("recovers publication before registration without creating a second file", async () => {
		register.mockRejectedValueOnce(new Error("registration failed"));
		await expect(handoff.complete([await entry()])).rejects.toThrow(
			"registration failed",
		);
		expect(RealtimeEventBus.publishSource).not.toHaveBeenCalled();
		expect(await resume()).toBe(true);
		expect(
			(await readdir(base)).filter((name) => name.endsWith(".png")),
		).toEqual(["image.png"]);
	});
	it("preserves unrelated files and resumes the same collision filename", async () => {
		await writeFile(path.join(base, "image.png"), "unrelated image");
		register.mockRejectedValueOnce(new Error("registration failed"));
		await expect(handoff.complete([await entry()])).rejects.toThrow(
			"registration failed",
		);
		expect(await resume()).toBe(true);
		expect(await readFile(path.join(base, "image.png"), "utf8")).toBe(
			"unrelated image",
		);
		expect(await readFile(path.join(base, "image_(1).png"), "utf8")).toBe(
			"completed download",
		);
		expect(
			(await readdir(base)).filter((name) => name.endsWith(".png")).sort(),
		).toEqual(["image.png", "image_(1).png"]);
	});
	it("resumes a partially registered multi-file download", async () => {
		register
			.mockResolvedValueOnce({
				id: "33333333-3333-4333-8333-333333333333",
				filePath: "first.png",
			})
			.mockRejectedValueOnce(new Error("second failed"));
		await expect(
			handoff.complete([await entry("first.png"), await entry("second.png")]),
		).rejects.toThrow("second failed");
		expect(saved.checkpoint).toMatchObject({
			entries: [{ published: true }, { published: false }],
		});
		expect(await resume()).toBe(true);
		expect(
			(await readdir(base)).filter((name) => name.endsWith(".png")).sort(),
		).toEqual(["first.png", "second.png"]);
	});
	it("rejects stale attempts before publication", async () => {
		vi.mocked(repo.withActiveClaim).mockRejectedValue(
			new Error("stale attempt"),
		);
		const prepared = await entry();
		await expect(handoff.complete([prepared])).rejects.toThrow("stale attempt");
		await expect(
			stat(path.join(base, prepared.filePath)),
		).rejects.toMatchObject({ code: "ENOENT" });
		expect(register).not.toHaveBeenCalled();
	});
	it("rejects paths outside the job staging directory", async () => {
		const prepared = await entry();
		prepared.stagedPath = path.join(base, "unrelated.png");
		await expect(handoff.complete([prepared])).rejects.toThrow(
			"Invalid download registration path",
		);
		expect(repo.saveCheckpoint).not.toHaveBeenCalled();
	});
	it("rejects a changed published file instead of attaching its original source URLs", async () => {
		await handoff.complete([await entry()]);
		register.mockClear();
		await writeFile(path.join(base, "image.png"), "replaced");
		await expect(resume()).rejects.toThrow("Published download changed");
		expect(register).not.toHaveBeenCalled();
	});
});

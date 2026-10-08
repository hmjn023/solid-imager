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
import type {
	IJobRepository,
	Job,
} from "@solid-imager/core/domain/repositories/job-repository";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadRegistration } from "~/infrastructure/jobs/download-registration";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishSource: vi.fn() },
}));
vi.mock("~/infrastructure/logger", () => ({ logger: { warn: vi.fn() } }));

describe("durable download registration", () => {
	let base: string;
	let job: Job;
	let saved: Job;
	let repo: IJobRepository;
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
			payload: { targetUrl: "https://example.com/image" },
		} as Job;
		saved = structuredClone(job);
		repo = {
			withActiveAttempt: vi.fn(async (_id, _attempt, action) =>
				action(undefined),
			),
			update: vi.fn(async (_id, data) => {
				saved = JSON.parse(JSON.stringify({ ...saved, ...data }));
			}),
		} as unknown as IJobRepository;
		register.mockImplementation(async (entry) => ({
			id: "media",
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
		vi.mocked(repo.update).mockImplementationOnce(async (_id, data) => {
			await expect(
				stat(path.join(base, prepared.filePath)),
			).rejects.toMatchObject({ code: "ENOENT" });
			saved = JSON.parse(JSON.stringify({ ...saved, ...data }));
		});
		register.mockImplementationOnce(async (item) => {
			expect(await readFile(path.join(base, item.filePath), "utf8")).toBe(
				"completed download",
			);
			expect(saved.payload).toMatchObject({
				downloadRegistration: {
					entries: [{ context: { sourceUrls: prepared.context.sourceUrls } }],
				},
			});
			return { id: "media", filePath: item.filePath };
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
		vi.mocked(repo.update).mockRejectedValueOnce(
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
			.mockResolvedValueOnce({ id: "first", filePath: "first.png" })
			.mockRejectedValueOnce(new Error("second failed"));
		await expect(
			handoff.complete([await entry("first.png"), await entry("second.png")]),
		).rejects.toThrow("second failed");
		expect(saved.payload).toMatchObject({
			downloadRegistration: {
				entries: [{ published: true }, { published: false }],
			},
		});
		expect(await resume()).toBe(true);
		expect(
			(await readdir(base)).filter((name) => name.endsWith(".png")).sort(),
		).toEqual(["first.png", "second.png"]);
	});
	it("rejects stale attempts before publication", async () => {
		vi.mocked(repo.withActiveAttempt).mockRejectedValue(
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
		expect(repo.update).not.toHaveBeenCalled();
	});
	it("rejects a changed published file instead of attaching its original source URLs", async () => {
		await handoff.complete([await entry()]);
		register.mockClear();
		await writeFile(path.join(base, "image.png"), "replaced");
		await expect(resume()).rejects.toThrow("Published download changed");
		expect(register).not.toHaveBeenCalled();
	});
});

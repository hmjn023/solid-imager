import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	unlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IAuthorRepository } from "@solid-imager/core/authors";
import type { CharacterRepository } from "@solid-imager/core/characters";
import type { IIpRepository } from "@solid-imager/core/ips";
import type { IJobRepository } from "@solid-imager/core/jobs";
import type { Media } from "@solid-imager/core/media";
import type { IMediaStorage } from "@solid-imager/core/ports";
import type { IProjectRepository } from "@solid-imager/core/projects";
import type { SourceRepository } from "@solid-imager/core/sources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaTransferService } from "../services/media-transfer-service";

const sourceId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const mediaId = "33333333-3333-4333-8333-333333333333";
const copiedId = "44444444-4444-4444-8444-444444444444";
let directory: string;
let sourcePath: string;
let targetPath: string;
beforeEach(async () => {
	directory = await mkdtemp(path.join(os.tmpdir(), "si-inner-transfer-"));
	sourcePath = path.join(directory, "source");
	targetPath = path.join(directory, "target");
	await Promise.all([mkdir(sourcePath), mkdir(targetPath)]);
	await writeFile(path.join(sourcePath, "image.png"), "source bytes");
});
afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

function setup() {
	const sourceMedia = {
		id: mediaId,
		mediaSourceId: sourceId,
		filePath: "image.png",
		fileName: "image.png",
		mediaType: "image",
		width: 1,
		height: 1,
		fileSize: 12,
		description: null,
		createdAt: new Date(),
		modifiedAt: new Date(),
	} as Media;
	const copiedMedia = { ...sourceMedia, id: copiedId, mediaSourceId: targetId };
	const mediaRepository = {
		findById: vi.fn(async () => sourceMedia),
		create: vi.fn(async () => copiedMedia),
		getAuthors: vi.fn(async () => []),
		getUrls: vi.fn(async () => []),
		addUrls: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
	const findSource = vi.fn(async (id: string) => ({
		id,
		type: "local",
		connectionInfo: { path: id === sourceId ? sourcePath : targetPath },
	}));
	const deleteFile = vi.fn(async (base: string, relative: string) => {
		await unlink(path.join(base, relative));
	});
	const storage = {
		copyFile: vi.fn(async (from: string, base: string) => {
			await copyFile(from, path.join(base, "image.png"));
			return {
				filePath: "image.png",
				fileName: "image.png",
				width: 1,
				height: 1,
				size: 12,
				createdAt: new Date(),
				modifiedAt: new Date(),
			};
		}),
		deleteFile,
	} as unknown as IMediaStorage;
	const transfer = new MediaTransferService(
		mediaRepository,
		{ findById: findSource } as unknown as SourceRepository,
		storage,
		{} as IAuthorRepository,
		{ findByMediaId: vi.fn(async () => []) } as unknown as IProjectRepository,
		{ findByMediaId: vi.fn(async () => []) } as unknown as CharacterRepository,
		{ findByMediaId: vi.fn(async () => []) } as unknown as IIpRepository,
		{ transaction: async (callback) => callback({}) },
		{} as IJobRepository,
		{ publishSource: vi.fn(), notifyMediaCopied: vi.fn() },
		{ deleteThumbnail: vi.fn() },
		{ info: vi.fn(), error: vi.fn(), warn: vi.fn() },
		{ execute: vi.fn() },
		{ addContextMetadataToExistingMedia: vi.fn() },
	);
	return { transfer, mediaRepository, findSource, deleteFile };
}

describe("inner media transfer recovery", () => {
	it.each(["create", "metadata"] as const)(
		"preserves an unreconciled marker when %s fails after the physical copy and cleanup also fails",
		async (failure) => {
			const { transfer, mediaRepository, deleteFile } = setup();
			const databaseError = new Error(`database failure ${directory}`);
			if (failure === "create")
				mediaRepository.create.mockRejectedValueOnce(databaseError);
			else mediaRepository.getAuthors.mockRejectedValueOnce(databaseError);
			deleteFile.mockRejectedValueOnce(
				new Error(`cleanup failure ${directory}`),
			);
			const error = await transfer
				.copyMedia(mediaId, targetId, {})
				.catch((cause: unknown) => cause);
			expect(error).toMatchObject({ name: "UnreconciledStorageError" });
			expect(error instanceof Error && error.message).not.toContain(directory);
			expect(await readFile(path.join(targetPath, "image.png"), "utf8")).toBe(
				"source bytes",
			);
		},
	);
	it("marks a move's inner rollback unsafe when deleting the source row and cleaning the target copy both fail", async () => {
		const { transfer, mediaRepository, deleteFile } = setup();
		mediaRepository.delete.mockRejectedValueOnce(
			new Error("source DB delete failed"),
		);
		deleteFile.mockRejectedValueOnce(new Error("copy cleanup failed"));
		await expect(
			transfer.moveMedia(mediaId, targetId, {}),
		).rejects.toMatchObject({ name: "UnreconciledStorageError" });
		expect(await readFile(path.join(targetPath, "image.png"), "utf8")).toBe(
			"source bytes",
		);
		expect(await readFile(path.join(sourcePath, "image.png"), "utf8")).toBe(
			"source bytes",
		);
	});
	it("marks a post-copy destination lookup failure unsafe instead of replaying the transfer", async () => {
		const { transfer, findSource } = setup();
		findSource
			.mockResolvedValueOnce({
				id: sourceId,
				type: "local",
				connectionInfo: { path: sourcePath },
			})
			.mockResolvedValueOnce({
				id: targetId,
				type: "local",
				connectionInfo: { path: targetPath },
			})
			.mockRejectedValueOnce(new Error("target lookup failed after copy"));
		await expect(
			transfer.moveMedia(mediaId, targetId, {}),
		).rejects.toMatchObject({ name: "UnreconciledStorageError" });
		expect(await readFile(path.join(targetPath, "image.png"), "utf8")).toBe(
			"source bytes",
		);
	});
	it("retains the original retryable error when inner compensation successfully removes the copy", async () => {
		const { transfer, mediaRepository } = setup();
		const databaseError = new Error("create failed");
		mediaRepository.create.mockRejectedValueOnce(databaseError);
		await expect(transfer.copyMedia(mediaId, targetId, {})).rejects.toBe(
			databaseError,
		);
		await expect(
			readFile(path.join(targetPath, "image.png")),
		).rejects.toThrow();
	});
});

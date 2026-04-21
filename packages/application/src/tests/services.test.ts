import type { Character } from "@solid-imager/core/domain/characters/schemas";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { Preset } from "@solid-imager/core/domain/media/schemas";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { describe, expect, it, vi } from "vite-plus/test";
import { createCharacterService } from "../services/character-service";
import {
	hasMediaProcessingStep,
	queueMediaProcessingJob,
} from "../services/media-processing-job";
import { createPresetService } from "../services/preset-service";

describe("shared application services", () => {
	it("rejects duplicate preset names", async () => {
		const preset: Preset = {
			id: 1,
			name: "default",
			value: { type: "group", operator: "and", children: [] },
			createdAt: new Date(),
		};
		const repository: PresetRepository = {
			list: vi.fn(async () => [preset]),
			get: vi.fn(async () => preset),
			getByName: vi.fn(async () => preset),
			create: vi.fn(async () => preset),
			update: vi.fn(async () => preset),
			delete: vi.fn(async () => true),
		};

		const service = createPresetService(repository);

		await expect(
			service.create({
				name: "default",
				value: { type: "group", operator: "and", children: [] },
			}),
		).rejects.toThrow(ResourceConflictError);
	});

	it("links character IPs when adding a character to media", async () => {
		const tx = Symbol("tx") as Transaction;
		const character: Character = {
			id: "00000000-0000-0000-0000-000000000001",
			name: "Character",
			description: "",
			ips: [{ id: "00000000-0000-0000-0000-000000000002", name: "IP" }],
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const characterRepository: CharacterRepository = {
			findAll: vi.fn(async () => [character]),
			findById: vi.fn(async () => character),
			findByName: vi.fn(async () => character),
			create: vi.fn(async () => character),
			update: vi.fn(async () => character),
			delete: vi.fn(async () => undefined),
			findByMediaId: vi.fn(async () => [character]),
			getMediaCharacters: vi.fn(async () => []),
			addToMedia: vi.fn(async () => undefined),
			removeFromMedia: vi.fn(async () => undefined),
			addToMediaBulk: vi.fn(async () => undefined),
		};
		const ipRepository: IIpRepository = {
			findAll: vi.fn(async () => []),
			findById: vi.fn(async () => null),
			findByName: vi.fn(async () => null),
			findByNames: vi.fn(async () => []),
			create: vi.fn(async () => {
				throw new Error("not used");
			}),
			update: vi.fn(async () => {
				throw new Error("not used");
			}),
			delete: vi.fn(async () => undefined),
			findByMediaId: vi.fn(async () => []),
			getMediaIps: vi.fn(async () => []),
			addMedia: vi.fn(async () => undefined),
			removeMedia: vi.fn(async () => undefined),
			addMediaBulk: vi.fn(async () => undefined),
		};
		const service = createCharacterService({
			characterRepository,
			ipRepository,
			transactionManager: {
				async transaction<T>(callback: (nextTx: Transaction) => Promise<T>) {
					return await callback(tx);
				},
			},
		});

		await service.addCharacterToMedia(
			"00000000-0000-0000-0000-000000000003",
			character.id,
		);

		expect(characterRepository.addToMedia).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000003",
			character.id,
			undefined,
			undefined,
			tx,
		);
		expect(ipRepository.addMedia).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000003",
			"00000000-0000-0000-0000-000000000002",
			undefined,
			"character_link",
			tx,
		);
	});

	it("uses default media processing steps and queues process jobs", async () => {
		const jobRepo = {
			create: vi.fn(async () => ({})),
		};

		expect(hasMediaProcessingStep(undefined, "extractMetadata")).toBe(true);

		await queueMediaProcessingJob({
			jobRepo,
			mediaId: "media-id",
			mediaSourceId: "source-id",
			sourcePath: "/source",
		});

		expect(jobRepo.create).toHaveBeenCalledWith({
			type: "processMedia",
			mediaSourceId: "source-id",
			payload: {
				mediaId: "media-id",
				sourcePath: "/source",
				steps: undefined,
				type: "processMedia",
			},
		});
	});
});

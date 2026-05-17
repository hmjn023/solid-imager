import type {
	Character,
	NewCharacter,
	UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { and, eq, inArray, sql, type InferSelectModel } from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import {
	characterIps,
	characters,
	ips,
	mediaCharacters,
} from "~/infrastructure/db/schema";

export class DrizzleCharacterRepository implements CharacterRepository {
	async findAll(): Promise<Character[]> {
		try {
			const results = await db.query.characters.findMany({
				with: {
					ips: {
						with: {
							ip: true,
						},
					},
				},
			});
			return results.map((r) => ({
				...r,
				ips: r.ips.map((i) => i.ip),
			}));
		} catch (error) {
			throw new UnexpectedError("Failed to select characters", error);
		}
	}

	async findById(id: string, tx?: Transaction): Promise<Character | null> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client.query.characters.findFirst({
				where: eq(characters.id, id),
				with: {
					ips: {
						with: {
							ip: true,
						},
					},
				},
			});
			if (!result) {
				return null;
			}
			return {
				...result,
				ips: result.ips.map((i) => i.ip),
			};
		} catch (error) {
			throw new UnexpectedError(
				`Failed to select character by ID: ${id}`,
				error,
			);
		}
	}

	async findByName(name: string, tx?: Transaction): Promise<Character | null> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client.query.characters.findFirst({
				where: eq(characters.name, name),
				with: {
					ips: {
						with: {
							ip: true,
						},
					},
				},
			});
			if (!result) {
				return null;
			}
			return {
				...result,
				ips: result.ips.map((i) => i.ip),
			};
		} catch (error) {
			throw new UnexpectedError(
				`Failed to select character by name: ${name}`,
				error,
			);
		}
	}

	async create(character: NewCharacter, tx?: Transaction): Promise<Character> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const { ipIds, ...charData } = character;

			const [insertedChar] = await client
				.insert(characters)
				.values({
					...charData,
					description: charData.description ?? "",
				})
				.returning();

			if (ipIds && ipIds.length > 0) {
				await client.insert(characterIps).values(
					ipIds.map((ipId) => ({
						characterId: insertedChar.id,
						ipId,
						source: character.source || "manual",
					})),
				);
			}

		// Build result from returned row + IP fetch (avoiding re-fetch)
		let ipsResult: Array<{ id: string; name: string }> = [];
		if (ipIds && ipIds.length > 0) {
			ipsResult = await client
				.select({ id: ips.id, name: ips.name })
				.from(ips)
				.where(inArray(ips.id, ipIds));
		}

		return { ...insertedChar, ips: ipsResult } as Character;
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code: string }).code === "23505"
			) {
				throw new ResourceConflictError(
					"Character with this name already exists",
				);
			}
			throw new UnexpectedError("Failed to insert character", error);
		}
	}

	async update(
		id: string,
		character: UpdateCharacter,
		tx?: Transaction,
	): Promise<Character> {
		try {
			const operation = async (client: TransactionClient) => {
				const { ipIds, ...charData } = character;

				const updatedData = await this._validateAndUpdateCharacter({
					id,
					charData,
					ipIds,
					client,
					tx: tx ?? (client as unknown as Transaction),
				});
				await this._updateCharacterIps(id, ipIds, character.source, client);

				if (!updatedData) {
					// No character data changed — fetch existing
					const existing = await this.findById(
						id,
						tx ?? (client as unknown as Transaction),
					);
					if (!existing) {
						throw new ResourceNotFoundError("Character", id);
					}
					return existing as Character;
				}

				// Build result from returned row + IP fetch (avoiding re-fetch)
				let ipsResult: Array<{ id: string; name: string }> = [];
				if (ipIds && ipIds.length > 0) {
					ipsResult = await client
						.select({ id: ips.id, name: ips.name })
						.from(ips)
						.where(inArray(ips.id, ipIds));
				} else if (ipIds === undefined) {
					// IPs not specified — fetch existing associations
					const existingIps = await client
						.select({ id: ips.id, name: ips.name })
						.from(ips)
						.innerJoin(characterIps, eq(characterIps.ipId, ips.id))
						.where(eq(characterIps.characterId, id));
					ipsResult = existingIps;
				}

				return { ...updatedData, ips: ipsResult } as Character;
			};

			if (tx) {
				return await operation(tx as unknown as TransactionClient);
			}
			return await db.transaction((innerTx) =>
				operation(innerTx as unknown as TransactionClient),
			);
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				(error as { code: string }).code === "23505"
			) {
				throw new ResourceConflictError(
					"Character with this name already exists",
				);
			}
			throw new UnexpectedError(
				`Failed to update character with ID: ${id}`,
				error,
			);
		}
	}

	private async _validateAndUpdateCharacter(options: {
		id: string;
		charData: Partial<UpdateCharacter>;
		ipIds: string[] | undefined;
		client: TransactionClient;
		tx?: Transaction;
	}): Promise<InferSelectModel<typeof characters> | null> {
		const { id, charData, ipIds, client, tx } = options;
		if (Object.keys(charData).length > 0 || ipIds !== undefined) {
			if (Object.keys(charData).length === 0) {
				// Only IPs changing — simple existence check
				const [existing] = await client
					.select()
					.from(characters)
					.where(eq(characters.id, id))
					.limit(1);
				if (!existing) {
					throw new ResourceNotFoundError("Character", id);
				}
				return existing;
			}

			if (Object.keys(charData).length > 0) {
				const result = await client
					.update(characters)
					.set({
						...charData,
						updatedAt: new Date(),
					})
					.where(eq(characters.id, id))
					.returning();

				if (result.length === 0) {
					throw new ResourceNotFoundError("Character", id);
				}
				return result[0];
			}
		}
		return null;
	}

	private async _updateCharacterIps(
		id: string,
		ipIds: string[] | undefined,
		source: string | undefined,
		client: TransactionClient,
	): Promise<void> {
		if (ipIds !== undefined) {
			await client.delete(characterIps).where(eq(characterIps.characterId, id));

			if (ipIds.length > 0) {
				await client.insert(characterIps).values(
					ipIds.map((ipId) => ({
						characterId: id,
						ipId,
						source: source || "manual",
					})),
				);
			}
		}
	}

	async delete(id: string, tx?: Transaction): Promise<void> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client
				.delete(characters)
				.where(eq(characters.id, id))
				.returning();

			if (result.length === 0) {
				throw new ResourceNotFoundError("Character", id);
			}
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			throw new UnexpectedError(
				`Failed to delete character with ID: ${id}`,
				error,
			);
		}
	}

	async findByMediaId(mediaId: string, tx?: Transaction): Promise<Character[]> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			// Use query builder to get relations
			const results = await client.query.mediaCharacters.findMany({
				where: eq(mediaCharacters.mediaId, mediaId),
				with: {
					character: {
						with: {
							ips: {
								with: {
									ip: true,
								},
							},
						},
					},
				},
			});

			return results.map((r) => ({
				...r.character,
				ips: r.character.ips.map((i) => i.ip),
			}));
		} catch (error) {
			throw new UnexpectedError(
				`Failed to find characters for media: ${mediaId}`,
				error,
			);
		}
	}

	async getMediaCharacters(
		mediaId: string,
		tx?: Transaction,
	): Promise<
		(Character & { confidence: number | null; associationSource: string })[]
	> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const results = await client.query.mediaCharacters.findMany({
				where: eq(mediaCharacters.mediaId, mediaId),
				with: {
					character: {
						with: {
							ips: {
								with: {
									ip: true,
								},
							},
						},
					},
				},
			});

			return results.map((r) => ({
				...r.character,
				ips: r.character.ips.map((i) => i.ip),
				confidence: r.confidence,
				associationSource: r.source,
			}));
		} catch (error) {
			throw new UnexpectedError(
				`Failed to find media characters for media: ${mediaId}`,
				error,
			);
		}
	}

	async addToMedia(
		mediaId: string,
		characterId: string,
		confidence?: number,
		source = "manual",
		tx?: Transaction,
	): Promise<void> {
		try {
			const client = (tx as unknown as TransactionClient) || db;

			let sourceUpdateSql = sql`excluded.source`;
			let confidenceUpdateSql = sql`excluded.confidence`;

			if (source === "AI") {
				// Only update if current is 'AI'
				sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
				confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
			} else if (source === "manual") {
				// Update if current is 'AI' or 'manual'.
				sourceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.source ELSE media_characters.source END`;
				confidenceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_characters.confidence END`;
			}

			await client
				.insert(mediaCharacters)
				.values({
					mediaId,
					characterId,
					confidence: confidence ?? null,
					source,
				})
				.onConflictDoUpdate({
					target: [mediaCharacters.mediaId, mediaCharacters.characterId],
					set: {
						confidence: confidenceUpdateSql,
						source: sourceUpdateSql,
					},
				});
		} catch (error: unknown) {
			throw new UnexpectedError(
				`Failed to add character ${characterId} to media ${mediaId}`,
				error,
			);
		}
	}

	async removeFromMedia(
		mediaId: string,
		characterId: string,
		tx?: Transaction,
	): Promise<void> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			await client
				.delete(mediaCharacters)
				.where(
					and(
						eq(mediaCharacters.mediaId, mediaId),
						eq(mediaCharacters.characterId, characterId),
					),
				);
		} catch (error) {
			throw new UnexpectedError(
				`Failed to remove character ${characterId} from media ${mediaId}`,
				error,
			);
		}
	}
	async addToMediaBulk(
		mediaId: string,
		charactersData: { id: string; confidence?: number }[],
		source = "manual",
		tx?: Transaction,
	): Promise<void> {
		const client = (tx as unknown as TransactionClient) || db;
		if (charactersData.length === 0) {
			return;
		}

		let sourceUpdateSql = sql`excluded.source`;
		let confidenceUpdateSql = sql`excluded.confidence`;

		if (source === "AI") {
			sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
		} else if (source === "manual") {
			sourceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.source ELSE media_characters.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_characters.confidence END`;
		}

		try {
			await client
				.insert(mediaCharacters)
				.values(
					charactersData.map((char) => ({
						mediaId,
						characterId: char.id,
						confidence: char.confidence ?? null,
						source,
					})),
				)
				.onConflictDoUpdate({
					target: [mediaCharacters.mediaId, mediaCharacters.characterId],
					set: {
						confidence: confidenceUpdateSql,
						source: sourceUpdateSql,
					},
				});
		} catch (error) {
			throw new UnexpectedError(
				`Failed to bulk add characters to media ${mediaId}`,
				error,
			);
		}
	}
}

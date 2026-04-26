import type {
	Character,
	NewCharacter,
	UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import { characterSchema } from "@solid-imager/core/domain/characters/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { and, eq, sql } from "drizzle-orm";
import { characterIps, characters, mediaCharacters } from "../schema";
import type { DrizzleExecutor } from "../types";

export type CharacterRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;
export type CharacterRepositoryTransactionRunner = <T>(
	callback: (tx: unknown) => Promise<T>,
) => Promise<T>;

type CreateCharacterRepositoryOptions = {
	orderByName?: boolean;
	throwOnMissingRemove?: boolean;
	transaction?: CharacterRepositoryTransactionRunner;
};

type CharacterWithIpsRow = typeof characters.$inferSelect & {
	ips: Array<{
		ip: {
			id: string;
			name: string;
		};
	}>;
};

type CharacterWithAssociation = Character & {
	confidence: number | null;
	associationSource: string;
};

function isUniqueViolation(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function mapToCharacter(row: CharacterWithIpsRow): Character {
	return characterSchema.parse({
		id: row.id,
		name: row.name,
		description: row.description,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		ips: row.ips.map((item) => ({
			id: item.ip.id,
			name: item.ip.name,
		})),
	});
}

function mediaCharacterConflictSet(source: string) {
	let sourceUpdateSql = sql`excluded.source`;
	let confidenceUpdateSql = sql`excluded.confidence`;

	if (source === "AI") {
		sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
	} else if (source === "manual") {
		sourceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.source ELSE media_characters.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_characters.confidence END`;
	}

	return {
		source: sourceUpdateSql,
		confidence: confidenceUpdateSql,
	};
}

export function createCharacterRepository(
	getExecutor: CharacterRepositoryExecutorProvider,
	options: CreateCharacterRepositoryOptions = {},
): CharacterRepository {
	async function findCharacterWithIps(id: string, tx?: unknown): Promise<Character | null> {
		const row = await getExecutor(tx).query.characters.findFirst({
			where: eq(characters.id, id),
			with: {
				ips: {
					with: {
						ip: true,
					},
				},
			},
		});

		return row ? mapToCharacter(row) : null;
	}

	async function runWithTransaction<T>(
		tx: unknown | undefined,
		callback: (tx?: unknown) => Promise<T>,
	): Promise<T> {
		if (tx) {
			return await callback(tx);
		}
		if (options.transaction) {
			return await options.transaction(callback);
		}
		return await callback();
	}

	return {
		async findAll(): Promise<Character[]> {
			try {
				const rows = await getExecutor().query.characters.findMany({
					...(options.orderByName
						? { orderBy: (characters, { asc }) => [asc(characters.name)] }
						: {}),
					with: {
						ips: {
							with: {
								ip: true,
							},
						},
					},
				});
				return rows.map(mapToCharacter);
			} catch (error) {
				throw new UnexpectedError("Failed to select characters", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<Character | null> {
			try {
				return await findCharacterWithIps(id, tx);
			} catch (error) {
				throw new UnexpectedError(`Failed to select character by ID: ${id}`, error);
			}
		},

		async findByName(name: string, tx?: unknown): Promise<Character | null> {
			try {
				const row = await getExecutor(tx).query.characters.findFirst({
					where: eq(characters.name, name),
					with: {
						ips: {
							with: {
								ip: true,
							},
						},
					},
				});
				return row ? mapToCharacter(row) : null;
			} catch (error) {
				throw new UnexpectedError(`Failed to select character by name: ${name}`, error);
			}
		},

		async create(input: NewCharacter, tx?: unknown): Promise<Character> {
			try {
				return await runWithTransaction(tx, async (innerTx) => {
					const client = getExecutor(innerTx);
					const { ipIds, ...characterData } = input;
					const rows = await client
						.insert(characters)
						.values({
							name: characterData.name,
							description: characterData.description ?? "",
							source: characterData.source ?? "manual",
						})
						.returning();
					const created = rows[0];

					if (ipIds && ipIds.length > 0) {
						await client.insert(characterIps).values(
							ipIds.map((ipId) => ({
								characterId: created.id,
								ipId,
								source: input.source ?? "manual",
							})),
						);
					}

					const result = await findCharacterWithIps(created.id, innerTx);
					if (!result) {
						throw new UnexpectedError("Created character could not be reloaded");
					}
					return result;
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError("Character with this name already exists");
				}
				if (error instanceof UnexpectedError) {
					throw error;
				}
				throw new UnexpectedError("Failed to insert character", error);
			}
		},

		async update(id: string, input: UpdateCharacter, tx?: unknown): Promise<Character> {
			try {
				return await runWithTransaction(tx, async (innerTx) => {
					const client = getExecutor(innerTx);
					const { ipIds, ...characterData } = input;

					if (
						characterData.name !== undefined ||
						characterData.description !== undefined ||
						characterData.source !== undefined
					) {
						const rows = await client
							.update(characters)
							.set({
								...(characterData.name !== undefined ? { name: characterData.name } : {}),
								...(characterData.description !== undefined
									? { description: characterData.description ?? "" }
									: {}),
								...(characterData.source !== undefined ? { source: characterData.source } : {}),
								updatedAt: new Date(),
							})
							.where(eq(characters.id, id))
							.returning();

						if (!rows[0]) {
							throw new ResourceNotFoundError("Character", id);
						}
					} else {
						const existing = await findCharacterWithIps(id, innerTx);
						if (!existing) {
							throw new ResourceNotFoundError("Character", id);
						}
					}

					if (ipIds !== undefined) {
						await client.delete(characterIps).where(eq(characterIps.characterId, id));

						if (ipIds.length > 0) {
							await client.insert(characterIps).values(
								ipIds.map((ipId) => ({
									characterId: id,
									ipId,
									source: input.source ?? "manual",
								})),
							);
						}
					}

					const result = await findCharacterWithIps(id, innerTx);
					if (!result) {
						throw new ResourceNotFoundError("Character", id);
					}
					return result;
				});
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError("Character with this name already exists");
				}
				throw new UnexpectedError(`Failed to update character with ID: ${id}`, error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(tx)
					.delete(characters)
					.where(eq(characters.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("Character", id);
				}
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(`Failed to delete character with ID: ${id}`, error);
			}
		},

		async findByMediaId(mediaId: string, tx?: unknown): Promise<Character[]> {
			try {
				const rows = await getExecutor(tx).query.mediaCharacters.findMany({
					...(options.orderByName
						? {
								orderBy: (mediaCharacters, { asc }) => [asc(mediaCharacters.characterId)],
							}
						: {}),
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

				return rows.map((row) => mapToCharacter(row.character));
			} catch (error) {
				throw new UnexpectedError(`Failed to find characters for media: ${mediaId}`, error);
			}
		},

		async getMediaCharacters(mediaId: string, tx?: unknown): Promise<CharacterWithAssociation[]> {
			try {
				const rows = await getExecutor(tx).query.mediaCharacters.findMany({
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

				return rows.map((row) => ({
					...mapToCharacter(row.character),
					confidence: row.confidence,
					associationSource: row.source,
				}));
			} catch (error) {
				throw new UnexpectedError(`Failed to find media characters for media: ${mediaId}`, error);
			}
		},

		async addToMedia(
			mediaId: string,
			characterId: string,
			confidence?: number,
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			try {
				await getExecutor(tx)
					.insert(mediaCharacters)
					.values({
						mediaId,
						characterId,
						confidence: confidence ?? null,
						source,
					})
					.onConflictDoUpdate({
						target: [mediaCharacters.mediaId, mediaCharacters.characterId],
						set: mediaCharacterConflictSet(source),
					});
			} catch (error) {
				throw new UnexpectedError(
					`Failed to add character ${characterId} to media ${mediaId}`,
					error,
				);
			}
		},

		async removeFromMedia(mediaId: string, characterId: string, tx?: unknown): Promise<void> {
			try {
				const query = getExecutor(tx)
					.delete(mediaCharacters)
					.where(
						and(eq(mediaCharacters.mediaId, mediaId), eq(mediaCharacters.characterId, characterId)),
					);

				if (options.throwOnMissingRemove) {
					const rows = await query.returning();
					if (!rows[0]) {
						throw new ResourceNotFoundError("MediaCharacter association");
					}
					return;
				}

				await query;
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(
					`Failed to remove character ${characterId} from media ${mediaId}`,
					error,
				);
			}
		},

		async addToMediaBulk(
			mediaId: string,
			charactersData: { id: string; confidence?: number }[],
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			if (charactersData.length === 0) {
				return;
			}

			try {
				await getExecutor(tx)
					.insert(mediaCharacters)
					.values(
						charactersData.map((character) => ({
							mediaId,
							characterId: character.id,
							confidence: character.confidence ?? null,
							source,
						})),
					)
					.onConflictDoUpdate({
						target: [mediaCharacters.mediaId, mediaCharacters.characterId],
						set: mediaCharacterConflictSet(source),
					});
			} catch (error) {
				throw new UnexpectedError(`Failed to bulk add characters to media ${mediaId}`, error);
			}
		},
	};
}

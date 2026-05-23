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
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { and, eq, type InferSelectModel, inArray, sql } from "drizzle-orm";
import {
	characterIps,
	characters,
	ips,
	mediaCharacters,
} from "../schema";
import type { DrizzleExecutor } from "../types";

function mapCharacter(
	r: typeof characters.$inferSelect & {
		ips: Array<{ ip: typeof ips.$inferSelect }>;
	},
): Character {
	return {
		...r,
		ips: r.ips.map((i) => i.ip),
	};
}

export function createCharacterRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): CharacterRepository {
	return {
		async findAll(): Promise<Character[]> {
			try {
				const results = await getExecutor().query.characters.findMany({
					with: {
						ips: {
							with: {
								ip: true,
							},
						},
					},
				});
				return results.map(mapCharacter);
			} catch (error) {
				throw new UnexpectedError("Failed to select characters", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<Character | null> {
			try {
				const result = await getExecutor(tx).query.characters.findFirst({
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
				return mapCharacter(result);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select character by ID: ${id}`,
					error,
				);
			}
		},

		async findByName(name: string, tx?: unknown): Promise<Character | null> {
			try {
				const result = await getExecutor(tx).query.characters.findFirst({
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
				return mapCharacter(result);
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select character by name: ${name}`,
					error,
				);
			}
		},

		async findByNames(names: string[], tx?: unknown): Promise<Character[]> {
			if (names.length === 0) {
				return [];
			}
			try {
				const results = await getExecutor(tx).query.characters.findMany({
					where: inArray(characters.name, names),
					with: {
						ips: {
							with: {
								ip: true,
							},
						},
					},
				});
				return results.map(mapCharacter);
			} catch (error) {
				throw new UnexpectedError("Failed to select characters by names", error);
			}
		},

		async create(
			character: NewCharacter,
			tx?: unknown,
		): Promise<Character> {
			try {
				const client = getExecutor(tx);
				const { ipIds, ...charData } = character;

				const [insertedChar] = await client
					.insert(characters)
					.values({
						...charData,
						description: charData.description ?? "",
					})
					.returning();

				if (ipIds && ipIds.length > 0) {
					await client
						.insert(characterIps)
						.values(
							ipIds.map((ipId) => ({
								characterId: insertedChar.id,
								ipId,
								source: character.source || "manual",
							})),
						)
						.onConflictDoNothing();
				}

				// Build result from returned row + IP fetch (avoiding re-fetch)
				let ipsResult: Array<typeof ips.$inferSelect> = [];
				if (ipIds && ipIds.length > 0) {
					ipsResult = await client
						.select()
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
		},

		async update(
			id: string,
			character: UpdateCharacter,
			tx?: unknown,
		): Promise<Character> {
			try {
				const operation = async (client: DrizzleExecutor) => {
					const { ipIds, ...charData } = character;

					const updatedData = await _validateAndUpdateCharacter({
						id,
						charData,
						ipIds,
						client,
						tx: tx ?? client,
					});
					await _updateCharacterIps(id, ipIds, character.source, client);

					if (!updatedData) {
						// No character data changed — fetch existing
						const existing = await this.findById(
							id,
							tx ?? client,
						);
						if (!existing) {
							throw new ResourceNotFoundError("Character", id);
						}
						return existing as Character;
					}

					// Build result from returned row + IP fetch (avoiding re-fetch)
					let ipsResult: Array<typeof ips.$inferSelect> = [];
					if (ipIds && ipIds.length > 0) {
						ipsResult = await client
							.select()
							.from(ips)
							.where(inArray(ips.id, ipIds));
					} else if (ipIds === undefined) {
						// IPs not specified — fetch existing associations via subquery
						const ipIdsSubquery = client
							.select({ ipId: characterIps.ipId })
							.from(characterIps)
							.where(eq(characterIps.characterId, id));
						const existingIps = await client
							.select()
							.from(ips)
							.where(inArray(ips.id, ipIdsSubquery));
						ipsResult = existingIps;
					}

					return { ...updatedData, ips: ipsResult } as Character;
				};

				if (tx) {
					return await operation(getExecutor(tx));
				}
				return await getExecutor().transaction((innerTx) =>
					operation(innerTx),
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
		},

		async updateIpsBulk(
			updates: Array<{ id: string; ipIds: string[] }>,
			source?: string,
			tx?: unknown,
		): Promise<void> {
			if (updates.length === 0) {
				return;
			}
			try {
				const client = getExecutor(tx);
				const characterIds = updates.map((u) => u.id);

				// Delete all existing IP links for these characters
				await client
					.delete(characterIps)
					.where(inArray(characterIps.characterId, characterIds));

				// Build and insert all new IP links in bulk
				const allIpLinks: Array<{
					characterId: string;
					ipId: string;
					source: string;
				}> = [];
				for (const { id, ipIds } of updates) {
					for (const ipId of ipIds) {
						allIpLinks.push({
							characterId: id,
							ipId,
							source: source || "manual",
						});
					}
				}

				if (allIpLinks.length > 0) {
					await client.insert(characterIps).values(allIpLinks).onConflictDoNothing();
				}
			} catch (error) {
				throw new UnexpectedError("Failed to bulk update character IPs", error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const client = getExecutor(tx);
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
		},

		async findByMediaId(
			mediaId: string,
			tx?: unknown,
		): Promise<Character[]> {
			try {
				const client = getExecutor(tx);
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
		},

		async getMediaCharacters(
			mediaId: string,
			tx?: unknown,
		): Promise<
			(Character & { confidence: number | null; associationSource: string })[]
		> {
			try {
				const client = getExecutor(tx);
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
		},

		async addToMedia(
			mediaId: string,
			characterId: string,
			confidence?: number,
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			try {
				const client = getExecutor(tx);

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
		},

		async removeFromMedia(
			mediaId: string,
			characterId: string,
			tx?: unknown,
		): Promise<void> {
			try {
				const client = getExecutor(tx);
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
		},

		async addToMediaBulk(
			mediaId: string,
			charactersData: { id: string; confidence?: number }[],
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			const client = getExecutor(tx);
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
		},

		async findOrCreateBulk(
			charactersData: Array<{ name: string; ipIds?: string[] }>,
			source?: string,
			tx?: unknown,
		): Promise<Character[]> {
			if (charactersData.length === 0) {
				return [];
			}
			const client = getExecutor(tx);
			const names = [
				...new Set(
					charactersData.map((c) => c.name.trim()).filter((n) => n.length > 0),
				),
			];

			// Insert/update characters — ON CONFLICT DO UPDATE ensures RETURNING
			// gets both new and existing records in one query.
			const insertedRows = await client
				.insert(characters)
				.values(
					names.map((name) => ({
						name,
						source: source || "manual",
						description: "",
					})),
				)
				.onConflictDoUpdate({
					target: [characters.name],
					set: { name: sql`excluded.name` },
				})
				.returning();

			const characterIds = insertedRows.map((r) => r.id);

			// Fetch all characters with their IPs using the returned IDs
			const results = await client.query.characters.findMany({
				where: inArray(characters.id, characterIds),
				with: {
					ips: {
						with: {
							ip: true,
						},
					},
				},
			});

			// Build IP link insertions in bulk
			const ipLinks: Array<{
				characterId: string;
				ipId: string;
				source: string;
			}> = [];
			const resultsByName = new Map(results.map((c) => [c.name, c]));
			for (const charData of charactersData) {
				if (charData.ipIds && charData.ipIds.length > 0) {
					const char = resultsByName.get(charData.name);
					if (char) {
						for (const ipId of charData.ipIds) {
							ipLinks.push({
								characterId: char.id,
								ipId,
								source: source || "manual",
							});
						}
					}
				}
			}

			if (ipLinks.length > 0) {
				await client.insert(characterIps).values(ipLinks).onConflictDoNothing();
			}

			return results.map(mapCharacter);
		},
	};
}

async function _validateAndUpdateCharacter(options: {
	id: string;
	charData: Partial<UpdateCharacter>;
	ipIds: string[] | undefined;
	client: DrizzleExecutor;
	tx?: unknown;
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

async function _updateCharacterIps(
	id: string,
	ipIds: string[] | undefined,
	source: string | undefined,
	client: DrizzleExecutor,
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

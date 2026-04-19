import {
	type Character,
	characterSchema,
	type NewCharacter,
	type UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import { and, eq, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import {
	characterIps,
	characters,
	mediaCharacters,
} from "@solid-imager/db/schema";

function toCharacter(
	row: typeof characters.$inferSelect & {
		ips: Array<{ id: string; name: string }>;
	},
): Character {
	return characterSchema.parse(row);
}

async function findCharacterWithIps(
	id: string,
	executor: TauriDbExecutor = getTauriAppServices().db,
): Promise<Character | null> {
	const row = await executor.query.characters.findFirst({
		where: eq(characters.id, id),
		with: {
			ips: {
				with: {
					ip: true,
				},
			},
		},
	});

	if (!row) {
		return null;
	}

	return toCharacter({
		...row,
		ips: row.ips.map((item) => ({
			id: item.ip.id,
			name: item.ip.name,
		})),
	});
}

export const TauriCharacterRepository = {
	async findAll(): Promise<Character[]> {
		const rows = await getTauriAppServices().db.query.characters.findMany({
			orderBy: (characters, { asc }) => [asc(characters.name)],
			with: {
				ips: {
					with: {
						ip: true,
					},
				},
			},
		});

		return rows.map((row) =>
			toCharacter({
				...row,
				ips: row.ips.map((item) => ({
					id: item.ip.id,
					name: item.ip.name,
				})),
			}),
		);
	},

	async findById(id: string, tx?: TauriDbExecutor): Promise<Character | null> {
		return await findCharacterWithIps(id, tx);
	},

	async findByName(name: string): Promise<Character | null> {
		const row = await getTauriAppServices().db.query.characters.findFirst({
			where: eq(characters.name, name),
			with: {
				ips: {
					with: {
						ip: true,
					},
				},
			},
		});

		if (!row) {
			return null;
		}

		return toCharacter({
			...row,
			ips: row.ips.map((item) => ({
				id: item.ip.id,
				name: item.ip.name,
			})),
		});
	},

	async create(input: NewCharacter): Promise<Character> {
		const existing = await this.findByName(input.name);
		if (existing) {
			throw new ResourceConflictError(
				`Character with name '${input.name}' already exists`,
			);
		}
		const ipIds = input.ipIds ?? [];

		return await getTauriAppServices().db.transaction(async (tx) => {
			const rows = await tx
				.insert(characters)
				.values({
					name: input.name,
					description: input.description ?? "",
					source: input.source ?? "manual",
				})
				.returning();
			const created = rows[0];

			if (ipIds.length > 0) {
				await tx.insert(characterIps).values(
					ipIds.map((ipId) => ({
						characterId: created.id,
						ipId,
						source: input.source ?? "manual",
					})),
				);
			}

			const result = await tx.query.characters.findFirst({
				where: eq(characters.id, created.id),
				with: {
					ips: {
						with: {
							ip: true,
						},
					},
				},
			});

			if (!result) {
				throw new UnexpectedError("Created character could not be reloaded");
			}

			return toCharacter({
				...result,
				ips: result.ips.map((item) => ({
					id: item.ip.id,
					name: item.ip.name,
				})),
			});
		});
	},

	async update(id: string, input: UpdateCharacter): Promise<Character> {
		return await getTauriAppServices().db.transaction(async (tx) => {
			const rows = await tx
				.update(characters)
				.set({
					...(input.name !== undefined ? { name: input.name } : {}),
					...(input.description !== undefined
						? { description: input.description ?? "" }
						: {}),
					...(input.source !== undefined ? { source: input.source } : {}),
					updatedAt: new Date(),
				})
				.where(eq(characters.id, id))
				.returning();

			if (!rows[0]) {
				throw new ResourceNotFoundError("Character", id);
			}

			if (input.ipIds !== undefined) {
				await tx.delete(characterIps).where(eq(characterIps.characterId, id));

				if (input.ipIds.length > 0) {
					await tx.insert(characterIps).values(
						input.ipIds.map((ipId) => ({
							characterId: id,
							ipId,
							source: input.source ?? "manual",
						})),
					);
				}
			}

			const result = await tx.query.characters.findFirst({
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
				throw new ResourceNotFoundError("Character", id);
			}

			return toCharacter({
				...result,
				ips: result.ips.map((item) => ({
					id: item.ip.id,
					name: item.ip.name,
				})),
			});
		});
	},

	async delete(id: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(characters)
			.where(eq(characters.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Character", id);
		}
	},

	async findByMediaId(mediaId: string): Promise<Character[]> {
		const rows = await getTauriAppServices().db.query.mediaCharacters.findMany({
			orderBy: (mediaCharacters, { asc }) => [asc(mediaCharacters.characterId)],
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

		return rows.map((row) =>
			toCharacter({
				...row.character,
				ips: row.character.ips.map((item) => ({
					id: item.ip.id,
					name: item.ip.name,
				})),
			}),
		);
	},

	async addMedia(
		mediaId: string,
		characterId: string,
		confidence?: number,
		source = "manual",
		tx?: TauriDbExecutor,
	): Promise<void> {
		const executor = tx ?? getTauriAppServices().db;
		let sourceUpdateSql = sql`excluded.source`;
		let confidenceUpdateSql = sql`excluded.confidence`;

		if (source === "AI") {
			sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
		} else if (source === "manual") {
			sourceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.source ELSE media_characters.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_characters.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_characters.confidence END`;
		}

		await executor
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
	},

	async removeMedia(mediaId: string, characterId: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(mediaCharacters)
			.where(
				and(
					eq(mediaCharacters.mediaId, mediaId),
					eq(mediaCharacters.characterId, characterId),
				),
			)
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("MediaCharacter association");
		}
	},
};

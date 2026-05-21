import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { MediaMetadataContext } from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";

export type MediaContextMetadataDeps = {
	mediaRepository: IMediaRepository;
	authorRepository: IAuthorRepository;
	characterRepository: CharacterRepository;
	ipRepository: IIpRepository;
	projectRepository: IProjectRepository;
	tagRepository: TagRepository;
	logger?: { warn?(data: unknown, message?: string): void };
};

async function updateCharacterForMedia(
	mediaId: string,
	charData: NonNullable<MediaMetadataContext["characters"]>[number],
	deps: {
		characterRepository: CharacterRepository;
		ipRepository: IIpRepository;
	},
	contextIpNames?: string[],
	tx?: Transaction,
): Promise<void> {
	let character = await deps.characterRepository.findByName(charData.name, tx);

	const ipNamesToLink =
		charData.linkedIps && charData.linkedIps.length > 0
			? charData.linkedIps
			: contextIpNames;

	const ipIdsToLink = ipNamesToLink?.length
		? (await deps.ipRepository.findByNames(ipNamesToLink, tx)).map(
				(ip) => ip.id,
			)
		: [];

	if (!character) {
		character = await deps.characterRepository.create(
			{
				name: charData.name,
				description: charData.description ?? "",
				source: charData.source ?? "manual",
				ipIds: ipIdsToLink,
			},
			tx,
		);
		character = await deps.characterRepository.findById(character.id, tx);
	} else if (ipIdsToLink.length > 0) {
		const existingIpIds = character.ips?.map((i) => i.id) || [];
		const newIpIds = [...new Set([...existingIpIds, ...ipIdsToLink])];
		if (newIpIds.length > existingIpIds.length) {
			await deps.characterRepository.update(
				character.id,
				{ ipIds: newIpIds },
				tx,
			);
			character = await deps.characterRepository.findById(character.id, tx);
		}
	}

	if (!character) {
		return;
	}

	await deps.characterRepository.addToMedia(
		mediaId,
		character.id,
		charData.confidence ?? 1,
		charData.source ?? "manual",
		tx,
	);

	if (character.ips && character.ips.length > 0) {
		await deps.ipRepository.addMediaBulk(
			mediaId,
			character.ips.flatMap((ip) => (ip.id ? [{ id: ip.id }] : [])),
			"character_link",
			tx,
		);
	}
}

export async function updateMediaContextMetadata(
	mediaId: string,
	context: Partial<MediaMetadataContext>,
	deps: MediaContextMetadataDeps,
	tx?: Transaction,
): Promise<void> {
	const {
		mediaRepository,
		authorRepository,
		characterRepository,
		ipRepository,
		projectRepository,
		tagRepository,
		logger,
	} = deps;

	if (context.sourceUrls?.length) {
		await mediaRepository.addUrls(mediaId, context.sourceUrls, tx);
	}

	if (context.authors?.length) {
		for (const author of context.authors) {
			try {
				let existing = await authorRepository.findByName(author.name, tx);
				if (!existing) {
					existing = await authorRepository.create(
						{
							name: author.name,
							accountId: author.accountId ?? null,
						},
						tx,
					);
				}
				await authorRepository.addMedia(mediaId, existing.id, tx);
			} catch (e) {
				logger?.warn?.({ err: e, author }, "Failed to register author");
			}
		}
	}

	if (context.tags?.length) {
		await tagRepository.addTagsToMedia(
			mediaId,
			context.tags.map((t) => ({
				name: t.name,
				type: (t.type ?? "positive") as "positive" | "negative",
				confidence: t.confidence ?? undefined,
			})),
			"user_provided",
			tx,
		);
	}

	if (context.ips?.length) {
		const normalizedIpsMap = new Map<
			string,
			NonNullable<MediaMetadataContext["ips"]>[number]
		>();
		for (const ip of context.ips) {
			const normalizedName = ip.name.trim();
			if (!normalizedIpsMap.has(normalizedName)) {
				normalizedIpsMap.set(normalizedName, ip);
			}
		}
		for (const [name, ipData] of normalizedIpsMap) {
			try {
				let existing = await ipRepository.findByName(name, tx);
				if (!existing) {
					existing = await ipRepository.create(
						{ name, description: ipData.description ?? "" },
						tx,
					);
				}
				await ipRepository.addMedia(
					mediaId,
					existing.id,
					ipData.confidence ?? undefined,
					ipData.source ?? "manual",
					tx,
				);
			} catch (e) {
				logger?.warn?.({ err: e, ip: ipData }, "Failed to register IP");
			}
		}
	}

	if (context.characters?.length) {
		const contextIpNames = context.ips?.flatMap((ip) =>
			ip.name?.trim() ? [ip.name.trim()] : [],
		);
		for (const charData of context.characters) {
			try {
				await updateCharacterForMedia(
					mediaId,
					charData,
					{ characterRepository, ipRepository },
					contextIpNames,
					tx,
				);
			} catch (e) {
				logger?.warn?.(
					{ err: e, character: charData },
					"Failed to register character",
				);
			}
		}
	}

	if (context.projects?.length) {
		for (const project of context.projects) {
			try {
				let existing = await projectRepository.findByName(project.name, tx);
				if (!existing) {
					existing = await projectRepository.create(
						{
							name: project.name,
							description: project.description ?? "",
						},
						tx,
					);
				}
				await projectRepository.addMedia(mediaId, existing.id, tx);
			} catch (e) {
				logger?.warn?.({ err: e, project }, "Failed to register project");
			}
		}
	}
}

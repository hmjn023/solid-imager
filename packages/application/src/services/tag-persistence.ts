import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";

export type TagPersistenceDeps = {
	tagRepository: Pick<TagRepository, "addTagsToMedia">;
	ipRepository: Pick<IIpRepository, "findByName" | "create" | "addMediaBulk">;
	characterRepository: Pick<
		CharacterRepository,
		"findByName" | "create" | "update" | "addToMediaBulk"
	>;
	source?: string;
	tx?: unknown;
};

export async function persistTaggingResponse(
	mediaId: string,
	response: TaggingResponse,
	deps: TagPersistenceDeps,
): Promise<void> {
	const source = deps.source ?? "AI";
	const tx = deps.tx;

	// 1. Tags
	const tagsToInsert = Object.entries(response.general).map(
		([name, confidence]) => ({
			name,
			type: "positive" as const,
			confidence,
		}),
	);
	await deps.tagRepository.addTagsToMedia(mediaId, tagsToInsert, source, tx);

	// 2. IPs
	const ipNameIdMap = new Map<string, string>();
	const ipsToLink: { id: string; confidence?: number }[] = [];

	for (const ipName of response.ips) {
		let ip = await deps.ipRepository.findByName(ipName, tx);
		if (!ip) {
			try {
				ip = await deps.ipRepository.create({ name: ipName, source }, tx);
			} catch (e) {
				if (e instanceof ResourceConflictError) {
					ip = await deps.ipRepository.findByName(ipName, tx);
				} else {
					throw e;
				}
			}
		}
		if (ip) {
			ipNameIdMap.set(ipName, ip.id);
			ipsToLink.push({ id: ip.id });
		}
	}

	if (ipsToLink.length > 0) {
		await deps.ipRepository.addMediaBulk(mediaId, ipsToLink, source, tx);
	}

	// 3. Characters
	const charToIpIdsMap = new Map<string, string[]>();

	for (const [charName, linkedIpNames] of Object.entries(
		response.ips_mapping,
	)) {
		const ipIds: string[] = [];
		for (const linkedIpName of linkedIpNames) {
			const ipId = ipNameIdMap.get(linkedIpName);
			if (ipId) {
				ipIds.push(ipId);
			}
		}
		if (ipIds.length > 0) {
			charToIpIdsMap.set(charName, ipIds);
		}
	}

	const charsToLink: { id: string; confidence: number }[] = [];

	for (const [charName, confidence] of Object.entries(response.character)) {
		const ipIds = charToIpIdsMap.get(charName) ?? [];
		let char = await deps.characterRepository.findByName(charName, tx);

		if (!char) {
			try {
				char = await deps.characterRepository.create(
					{
						name: charName,
						ipIds,
						source,
					},
					tx,
				);
			} catch (e) {
				if (e instanceof ResourceConflictError) {
					char = await deps.characterRepository.findByName(charName, tx);
				} else {
					throw e;
				}
			}
		} else if (char.ips.length === 0 && ipIds.length > 0) {
			try {
				await deps.characterRepository.update(char.id, { ipIds }, tx);
			} catch (e) {
				if (e instanceof ResourceConflictError) {
					// Ignore
				} else {
					throw e;
				}
			}
		} else if (ipIds.length > 0) {
			const existingIpIds = new Set(char.ips.map((i) => i.id));
			const newIpIds = ipIds.filter((id) => !existingIpIds.has(id));

			if (newIpIds.length > 0) {
				try {
					await deps.characterRepository.update(
						char.id,
						{
							ipIds: [...existingIpIds, ...newIpIds],
						},
						tx,
					);
				} catch (_e) {
					// Ignore conflict
				}
			}
		}

		if (char) {
			charsToLink.push({ id: char.id, confidence });
		}
	}

	if (charsToLink.length > 0) {
		await deps.characterRepository.addToMediaBulk(
			mediaId,
			charsToLink,
			source,
			tx,
		);
	}
}

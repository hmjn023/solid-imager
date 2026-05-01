import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import { DEFAULT_MANUAL_CONFIDENCE } from "@solid-imager/core/domain/tagging/constants";
import type {
	CcipFeatureResponse,
	TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";

export type AiInput =
	| { type: "path"; fullPath: string }
	| { type: "buffer"; buffer: ArrayBuffer };

export type ReconstructTaggingResponseDeps = {
	tagRepository: Pick<TagRepository, "findByMediaId">;
	characterRepository: Pick<CharacterRepository, "getMediaCharacters">;
	ipRepository: Pick<IIpRepository, "getMediaIps">;
};

export async function reconstructTaggingResponseFromCache(
	mediaId: string,
	deps: ReconstructTaggingResponseDeps,
): Promise<TaggingResponse | null> {
	const existingTags = await deps.tagRepository.findByMediaId(mediaId);
	const aiTags = existingTags.filter((t) => t.source === "AI");

	if (aiTags.length === 0) {
		return null;
	}

	const aiCharacters = (
		await deps.characterRepository.getMediaCharacters(mediaId)
	).filter((c) => c.associationSource === "AI");
	const aiIps = (await deps.ipRepository.getMediaIps(mediaId)).filter(
		(i) => i.associationSource === "AI",
	);

	const response: TaggingResponse = {
		general: {},
		character: {},
		ips: aiIps.map((i) => i.name),
		ips_mapping: {},
	};

	for (const tag of aiTags) {
		response.general[tag.name] = tag.confidence ?? DEFAULT_MANUAL_CONFIDENCE;
	}
	for (const char of aiCharacters) {
		response.character[char.name] =
			char.confidence ?? DEFAULT_MANUAL_CONFIDENCE;
	}

	const ipMap = new Map<string, string>();
	for (const ip of aiIps) {
		ipMap.set(ip.id, ip.name);
	}

	for (const char of aiCharacters) {
		const matchedIpNames: string[] = [];
		for (const charIp of char.ips) {
			const ipName = ipMap.get(charIp.id);
			if (ipName) {
				matchedIpNames.push(ipName);
			}
		}
		if (matchedIpNames.length > 0) {
			response.ips_mapping[char.name] = matchedIpNames;
		}
	}

	return response;
}

export function isAiServiceLocal(baseUrl?: string): boolean {
	if (!baseUrl) {
		return true; // Fallback: assume local
	}

	try {
		const url = new URL(baseUrl);
		const host = url.hostname.toLowerCase();
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host === "::1" ||
			host === "[::1]" ||
			host === "0.0.0.0"
		);
	} catch {
		return true; // Fallback: assume local if URL parsing fails
	}
}

export type ResolveAiInputDeps = {
	mediaSourceType: string;
	mediaSourceConnectionInfo: unknown;
	mediaFilePath: string;
	isAiServiceLocal: boolean;
	getBuffer: () => Promise<ArrayBuffer>;
	joinPath: (base: string, filePath: string) => string;
};

export async function resolveAiInput(
	deps: ResolveAiInputDeps,
): Promise<AiInput> {
	if (deps.mediaSourceType === "local" && deps.isAiServiceLocal) {
		const info = deps.mediaSourceConnectionInfo as { path: string };
		return {
			type: "path",
			fullPath: deps.joinPath(info.path, deps.mediaFilePath),
		};
	}
	return { type: "buffer", buffer: await deps.getBuffer() };
}

export type OrchestrateTaggingDeps = {
	aiClient: IAiClient;
	reconstructDeps: ReconstructTaggingResponseDeps;
	getAiBaseUrl: () => string | undefined;
	mediaSourceType: string;
	mediaSourceConnectionInfo: unknown;
	mediaFilePath: string;
	getBuffer: () => Promise<ArrayBuffer>;
	joinPath: (base: string, filePath: string) => string;
	persistResponse: (response: TaggingResponse) => Promise<void>;
};

export async function orchestrateTagging(
	mediaId: string,
	options: { skipCache?: boolean } | undefined,
	deps: OrchestrateTaggingDeps,
): Promise<TaggingResponse> {
	if (!options?.skipCache) {
		const cached = await reconstructTaggingResponseFromCache(
			mediaId,
			deps.reconstructDeps,
		);
		if (cached) {
			return cached;
		}
	}

	const input = await resolveAiInput({
		mediaSourceType: deps.mediaSourceType,
		mediaSourceConnectionInfo: deps.mediaSourceConnectionInfo,
		mediaFilePath: deps.mediaFilePath,
		isAiServiceLocal: isAiServiceLocal(deps.getAiBaseUrl()),
		getBuffer: deps.getBuffer,
		joinPath: deps.joinPath,
	});

	let response: TaggingResponse;
	if (input.type === "path") {
		response = await deps.aiClient.tagImageByPath(input.fullPath);
	} else {
		response = await deps.aiClient.tagImage(input.buffer);
	}

	await deps.persistResponse(response);
	return response;
}

export type OrchestrateCcipDeps = {
	aiClient: IAiClient;
	getAiBaseUrl: () => string | undefined;
	mediaSourceType: string;
	mediaSourceConnectionInfo: unknown;
	mediaFilePath: string;
	getBuffer: () => Promise<ArrayBuffer>;
	joinPath: (base: string, filePath: string) => string;
};

export async function orchestrateCcipExtraction(
	deps: OrchestrateCcipDeps,
): Promise<CcipFeatureResponse> {
	const input = await resolveAiInput({
		mediaSourceType: deps.mediaSourceType,
		mediaSourceConnectionInfo: deps.mediaSourceConnectionInfo,
		mediaFilePath: deps.mediaFilePath,
		isAiServiceLocal: isAiServiceLocal(deps.getAiBaseUrl()),
		getBuffer: deps.getBuffer,
		joinPath: deps.joinPath,
	});

	if (input.type === "path") {
		return await deps.aiClient.extractCcipFeatureByPath(input.fullPath);
	}
	return await deps.aiClient.extractCcipFeature(input.buffer);
}

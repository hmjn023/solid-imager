const SOURCE_REVISION_VERSION = 1;
const REGION_REVISION_VERSION = 1;
const CCIP_INPUT_REVISION_VERSION = 1;

export type MediaSourceRevisionInput = {
	mediaId: string;
	mediaSourceId: string;
	modifiedAt: Date;
	fileSize: number | null;
	width: number;
	height: number;
};

export type MediaRegionRevisionInput = {
	sourceRevision: string;
	kind: "full" | "person" | "manual";
	x: number | null;
	y: number | null;
	width: number | null;
	height: number | null;
	label: string | null;
	detector: string | null;
	detectorModel: string | null;
	detectorVersion: string | null;
	manualReason: string | null;
};

export type CcipEmbeddingInputRevisionInput = {
	sourceRevision: string;
	model: string;
	embeddingVersion: number;
	preprocessingProfile: string;
};

function assertFiniteInteger(value: number, name: string): void {
	if (!Number.isSafeInteger(value)) {
		throw new Error(`${name} must be a safe integer`);
	}
}

/**
 * Fixed-order source payload shared by runtime revision checks and SQL
 * migration fixtures. IDs deliberately prevent a revision from being moved
 * between otherwise identical media rows.
 */
export function canonicalMediaSourceRevisionPayload(
	input: MediaSourceRevisionInput,
): string {
	const modifiedAtMs = input.modifiedAt.getTime();
	assertFiniteInteger(modifiedAtMs, "modifiedAt");
	assertFiniteInteger(input.width, "width");
	assertFiniteInteger(input.height, "height");
	if (input.fileSize !== null) {
		assertFiniteInteger(input.fileSize, "fileSize");
	}
	return JSON.stringify({
		version: SOURCE_REVISION_VERSION,
		mediaId: input.mediaId,
		mediaSourceId: input.mediaSourceId,
		modifiedAtMs,
		fileSize: input.fileSize,
		width: input.width,
		height: input.height,
	});
}

/** Fixed-order payload for every render-relevant region field. */
export function canonicalMediaRegionRevisionPayload(
	input: MediaRegionRevisionInput,
): string {
	return JSON.stringify({
		version: REGION_REVISION_VERSION,
		sourceRevision: input.sourceRevision,
		kind: input.kind,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		label: input.label,
		detector: input.detector,
		detectorModel: input.detectorModel,
		detectorVersion: input.detectorVersion,
		manualReason: input.manualReason,
	});
}

/** Embedding-space identity layered over the underlying media revision. */
export function canonicalCcipEmbeddingInputRevisionPayload(
	input: CcipEmbeddingInputRevisionInput,
): string {
	assertFiniteInteger(input.embeddingVersion, "embeddingVersion");
	return JSON.stringify({
		version: CCIP_INPUT_REVISION_VERSION,
		sourceRevision: input.sourceRevision,
		model: input.model,
		embeddingVersion: input.embeddingVersion,
		preprocessingProfile: input.preprocessingProfile,
	});
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

export async function createMediaSourceRevision(
	input: MediaSourceRevisionInput,
): Promise<string> {
	return await sha256Hex(canonicalMediaSourceRevisionPayload(input));
}

export async function createMediaRegionRevision(
	input: MediaRegionRevisionInput,
): Promise<string> {
	return await sha256Hex(canonicalMediaRegionRevisionPayload(input));
}

export async function createCcipEmbeddingInputRevision(
	input: CcipEmbeddingInputRevisionInput,
): Promise<string> {
	return await sha256Hex(canonicalCcipEmbeddingInputRevisionPayload(input));
}

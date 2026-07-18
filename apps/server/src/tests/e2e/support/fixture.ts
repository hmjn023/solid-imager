import path from "node:path";

export const E2E_SOURCE_ID = "11111111-1111-4111-8111-111111111111";
export const E2E_PRIMARY_MEDIA_ID = "22222222-2222-4222-8222-222222222222";
export const E2E_SIMILAR_MEDIA_ID = "33333333-3333-4333-8333-333333333333";

export const E2E_SOURCE_NAME = "E2E Local Media";
export const E2E_PRIMARY_FILE_NAME = "e2e-primary.png";
export const E2E_SIMILAR_FILE_NAME = "e2e-similar.png";

export function getE2eRuntimeDir(): string {
	const runtimeDir = process.env.E2E_RUNTIME_DIR;
	if (!runtimeDir) {
		throw new Error("E2E_RUNTIME_DIR must be set by the E2E runner");
	}
	return path.resolve(runtimeDir);
}

export function getE2eMediaDir(): string {
	return path.join(getE2eRuntimeDir(), "media");
}

export function getFixtureMediaPath(fileName: string): string {
	return path.join(getE2eMediaDir(), fileName);
}

export function sourcePath(): string {
	return `/sources/${E2E_SOURCE_ID}`;
}

export function mediaPath(mediaId = E2E_PRIMARY_MEDIA_ID): string {
	return `/sources/${E2E_SOURCE_ID}/${mediaId}`;
}

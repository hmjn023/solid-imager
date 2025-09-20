import type { UUID } from "~/lib/utils";

export async function getDirectoryListing(sourceId: UUID, path?: string) {
	console.log("Placeholder: getDirectoryListing called", { sourceId, path });
	return { directories: [], media: [] };
}

export async function createDirectory(
	sourceId: UUID,
	path: string,
	name: string,
) {
	console.log("Placeholder: createDirectory called", { sourceId, path, name });
	return { success: true, fullPath: `${path}/${name}` };
}

export async function renameDirectory(
	sourceId: UUID,
	oldPath: string,
	newPath: string,
) {
	console.log("Placeholder: renameDirectory called", {
		sourceId,
		oldPath,
		newPath,
	});
	return { success: true, oldPath, newPath };
}

export async function deleteDirectory(sourceId: UUID, path: string) {
	console.log("Placeholder: deleteDirectory called", { sourceId, path });
	return { success: true, path };
}

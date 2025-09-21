import { getMediaSourceById } from "~/db";
import { getDriver } from "~/lib/drivers/factory";
import type { UUID } from "~/lib/utils";

export async function getDirectoryListing(sourceId: UUID, path = "") {
	const source = await getMediaSourceById(sourceId);
	if (!source) {
		throw new Error("指定されたメディアソースが見つかりません");
	}
	const driver = getDriver(source);
	return driver.list(path);
}

export async function createDirectory(
	sourceId: UUID,
	path: string,
	name: string,
) {
	const source = await getMediaSourceById(sourceId);
	if (!source) {
		throw new Error("指定されたメディアソースが見つかりません");
	}
	const driver = getDriver(source);
	const fullPath = `${path}/${name}`;
	await driver.createDirectory(fullPath);
	return { success: true, fullPath };
}

export async function renameDirectory(
	sourceId: UUID,
	oldPath: string,
	newPath: string,
) {
	const source = await getMediaSourceById(sourceId);
	if (!source) {
		throw new Error("指定されたメディアソースが見つかりません");
	}
	const driver = getDriver(source);
	await driver.rename(oldPath, newPath);
	return { success: true, oldPath, newPath };
}

export async function deleteDirectory(sourceId: UUID, path: string) {
	const source = await getMediaSourceById(sourceId);
	if (!source) {
		throw new Error("指定されたメディアソースが見つかりません");
	}
	const driver = getDriver(source);
	await driver.delete(path);
	return { success: true, path };
}

import { getMediaSourceById } from "~/infrastructure/api-clients/sources";
import { getDriver } from "~/infrastructure/storage/factory";

export async function getDirectoryListing(sourceId: string, path = "") {
  const sources = await getMediaSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  return driver.list(path);
}

export async function createDirectory(
  sourceId: string,
  path: string,
  name: string
) {
  const sources = await getMediaSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  const fullPath = `${path}/${name}`;
  await driver.createDirectory(fullPath);
  return { success: true, fullPath };
}

export async function renameDirectory(
  sourceId: string,
  oldPath: string,
  newPath: string
) {
  const sources = await getMediaSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  await driver.rename(oldPath, newPath);
  return { success: true, oldPath, newPath };
}

export async function deleteDirectory(sourceId: string, path: string) {
  const sources = await getMediaSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  await driver.delete(path);
  return { success: true, path };
}

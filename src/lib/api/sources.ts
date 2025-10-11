import {
  deleteMediaSource as dbDeleteMediaSource,
  insertMediaSource as dbInsertMediaSource,
  selectMediaSources as dbSelectMediaSources,
  updateMediaSource as dbUpdateMediaSource,
  selectMediaSourceById,
} from "~/db/index";
import type { MediaSource, NewMediaSource } from "~/db/schema";
import { getDriver } from "~/infrastructure/storage/factory";

export function getMediaSources() {
  return dbSelectMediaSources();
}

export function getMediaSourceById(sourceId: string) {
  return selectMediaSourceById(sourceId);
}

export async function createMediaSource(mediaSource: NewMediaSource) {
  // 新規作成時にも接続テストを実行
  const driver = getDriver(mediaSource as MediaSource);
  const connectionTest = await driver.testConnection();
  if (!connectionTest.success) {
    throw new Error(
      `接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`
    );
  }
  return dbInsertMediaSource(mediaSource);
}

export async function updateMediaSource(
  sourceId: string,
  data: Partial<NewMediaSource>
) {
  const sources = await selectMediaSourceById(sourceId);
  const originalSource = sources[0];
  if (!originalSource) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  // 更新データと元のデータをマージ
  const updatedSourceData = { ...originalSource, ...data };

  // 更新時にも接続テストを実行
  const driver = getDriver(updatedSourceData);
  const connectionTest = await driver.testConnection();
  if (!connectionTest.success) {
    throw new Error(
      `接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`
    );
  }

  return dbUpdateMediaSource(sourceId, data);
}

export function deleteMediaSource(sourceId: string) {
  return dbDeleteMediaSource(sourceId);
}

export async function testMediaSourceConnection(sourceId: string) {
  const sources = await selectMediaSourceById(sourceId);
  const source = sources[0];
  if (!source) {
    throw new Error("指定されたメディアソースが見つかりません");
  }
  const driver = getDriver(source);
  return driver.testConnection();
}

export async function getMediaSourceStatus(sourceId: string) {
  const test = await testMediaSourceConnection(sourceId);
  const status = test.success ? "active" : "error";
  return {
    sourceId,
    status,
    message: test.message,
    lastChecked: new Date(),
  };
}

import {
	deleteMediaSource as dbDeleteMediaSource,
	insertMediaSource as dbInsertMediaSource,
	selectMediaSources as dbSelectMediaSources,
	updateMediaSource as dbUpdateMediaSource,
	selectMediaSourceById,
} from "~/db/index";
import type { MediaSource, NewMediaSource } from "~/db/schema";
import { getDriver } from "~/lib/drivers/factory";
import type { UUID } from "~/lib/utils";

export async function getMediaSources() {
	return dbSelectMediaSources();
}

export async function getMediaSourceById(sourceId: UUID) {
	return selectMediaSourceById(sourceId);
}

export async function createMediaSource(mediaSource: NewMediaSource) {
	// 新規作成時にも接続テストを実行
	const driver = getDriver(mediaSource as MediaSource);
	const connectionTest = await driver.testConnection();
	if (!connectionTest.success) {
		throw new Error(
			`接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`,
		);
	}
	return dbInsertMediaSource(mediaSource);
}

export async function updateMediaSource(
	sourceId: UUID,
	data: Partial<NewMediaSource>,
) {
	const originalSource = await selectMediaSourceById(sourceId);
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
			`接続に失敗しました: ${connectionTest.message ?? "不明なエラー"}`,
		);
	}

	return dbUpdateMediaSource(sourceId, data);
}

export async function deleteMediaSource(sourceId: UUID) {
	return dbDeleteMediaSource(sourceId);
}

export async function testMediaSourceConnection(sourceId: UUID) {
	const source = await selectMediaSourceById(sourceId);
	if (!source) {
		throw new Error("指定されたメディアソースが見つかりません");
	}
	const driver = getDriver(source);
	return driver.testConnection();
}

export async function getMediaSourceStatus(sourceId: UUID) {
	const test = await testMediaSourceConnection(sourceId);
	const status = test.success ? "active" : "error";
	return {
		sourceId,
		status,
		message: test.message,
		lastChecked: new Date(),
	};
}

/// <reference types="bun-types" />
import fs from 'node:fs/promises';
import path from 'node:path';
import { initServices } from '../src/infrastructure/bootstrap';
import { db } from '../src/infrastructure/db';
import { medias } from '../src/infrastructure/db/schema';
import { getSourceCacheDir } from '../src/infrastructure/jobs/thumbnails';

async function main() {
	// Initialize configuration and registry services
	initServices();

	console.log('🔍 データベースからメディア一覧を取得中...');
	const allMedia = await db
		.select({
			id: medias.id,
			mediaSourceId: medias.mediaSourceId,
			filePath: medias.filePath,
			fileName: medias.fileName,
		})
		.from(medias);

	console.log(`📦 データベース内のメディア数: ${allMedia.length}`);

	if (allMedia.length === 0) {
		console.log('⚠️ メディアが登録されていません。');
		return;
	}

	const sourceIds = [...new Set(allMedia.map((m) => m.mediaSourceId))];
	console.log(`📂 検出されたメディアソース数: ${sourceIds.length}`);

	const existingThumbnailsBySource = new Map<string, Set<string>>();

	for (const sourceId of sourceIds) {
		const cacheDir = getSourceCacheDir(sourceId);
		try {
			const files = await fs.readdir(cacheDir);
			const ids = new Set(files.map((f) => path.basename(f, path.extname(f))));
			existingThumbnailsBySource.set(sourceId, ids);
			console.log(`  📁 ソース ${sourceId}: 既存サムネイル ${ids.size} 件 (パス: ${cacheDir})`);
		} catch (error) {
			existingThumbnailsBySource.set(sourceId, new Set());
			const err = error as { code?: string };
			if (err.code === 'ENOENT') {
				console.log(`  📁 ソース ${sourceId}: サムネイルキャッシュディレクトリが存在しません (パス: ${cacheDir})`);
			} else {
				console.error(`  ❌ ソース ${sourceId} のディレクトリ読み込みエラー:`, error);
			}
		}
	}

	const missingThumbnails: typeof allMedia = [];
	const statsBySource = new Map<string, { total: number; existing: number; missing: number }>();

	for (const sourceId of sourceIds) {
		const existingIds = existingThumbnailsBySource.get(sourceId) || new Set();
		statsBySource.set(sourceId, { total: 0, existing: existingIds.size, missing: 0 });
	}

	for (const media of allMedia) {
		const stats = statsBySource.get(media.mediaSourceId);
		if (stats) {
			stats.total++;
		}

		const existingIds = existingThumbnailsBySource.get(media.mediaSourceId);
		if (!existingIds || !existingIds.has(media.id)) {
			missingThumbnails.push(media);
			if (stats) {
				stats.missing++;
			}
		}
	}

	console.log('\n📊 照合結果:');
	console.log(`- 登録済みメディア総数: ${allMedia.length}`);
	console.log(`- サムネイル未生成数  : ${missingThumbnails.length}`);

	console.log('\n📂 ソースごとの内訳:');
	for (const [sourceId, stats] of statsBySource) {
		console.log(`  - ソースID: ${sourceId}`);
		console.log(`    - メディア総数: ${stats.total}`);
		console.log(`    - 生成済み    : ${stats.existing}`);
		console.log(`    - 未生成      : ${stats.missing}`);
	}

	if (missingThumbnails.length > 0) {
		console.log('\n🔍 未生成のサムネイル一覧 (最新50件を表示):');
		for (const media of missingThumbnails.slice(0, 50)) {
			console.log(`  - ID: ${media.id} | Source: ${media.mediaSourceId} | Path: ${media.filePath}`);
		}
		if (missingThumbnails.length > 50) {
			console.log(`  ... 他 ${missingThumbnails.length - 50} 件`);
		}
	} else {
		console.log('\n✅ すべてのサムネイルが正常に生成されています。');
	}
}

main().catch((err) => {
	console.error('❌ エラーが発生しました:', err);
	process.exit(1);
});

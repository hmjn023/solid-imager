/// <reference types="bun-types" />
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { initServices } from '../src/infrastructure/bootstrap';
import { db } from '../src/infrastructure/db';
import { medias, mediaUrls } from '../src/infrastructure/db/schema';
import { getSourceCacheDir } from '../src/infrastructure/jobs/thumbnails';

// Simple concurrency helper for downloading
async function runWithLimit<T>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<void>
) {
	let index = 0;
	const total = items.length;
	const workers = Array.from({ length: limit }, async () => {
		while (index < total) {
			const currentIndex = index++;
			const item = items[currentIndex];
			try {
				await fn(item);
			} catch (err) {
				console.error(`\n❌ エラーが発生しました (ID: ${(item as { id: string }).id}):`, err);
			}
		}
	});
	await Promise.all(workers);
}

async function main() {
	// Initialize configuration and registry services
	initServices();

	const args = process.argv.slice(2);
	const isDryRun = !args.includes('--execute');

	console.log('🔍 データベースからメディア一覧と URL 情報を取得中...');
	// medias と mediaUrls を結合して取得
	const mediaWithUrls = await db
		.select({
			id: medias.id,
			mediaSourceId: medias.mediaSourceId,
			filePath: medias.filePath,
			fileName: medias.fileName,
			url: mediaUrls.url,
		})
		.from(medias)
		.leftJoin(mediaUrls, eq(medias.id, mediaUrls.mediaId));

	console.log(`📦 データベース内のレコード数 (URL結合後): ${mediaWithUrls.length}`);

	// メディアIDごとに URL を整理 (1対多の重複を排除して最初のURLを採用)
	const mediaMap = new Map<string, {
		id: string;
		mediaSourceId: string;
		filePath: string;
		fileName: string;
		urls: string[];
	}>();

	for (const row of mediaWithUrls) {
		const existing = mediaMap.get(row.id);
		if (existing) {
			if (row.url && !existing.urls.includes(row.url)) {
				existing.urls.push(row.url);
			}
		} else {
			mediaMap.set(row.id, {
				id: row.id,
				mediaSourceId: row.mediaSourceId,
				filePath: row.filePath,
				fileName: row.fileName,
				urls: row.url ? [row.url] : [],
			});
		}
	}

	const allMedia = Array.from(mediaMap.values());

	// ソースパスの取得
	const sources = await db.query.mediaSources.findMany();
	const sourcePathMap = new Map<string, string>();
	for (const source of sources) {
		if (source.type === 'local') {
			const basePath = (source.connectionInfo as { path?: string }).path;
			if (basePath) {
				sourcePathMap.set(source.id, basePath);
			}
		}
	}

	const sourceIds = [...new Set(allMedia.map((m) => m.mediaSourceId))];
	const existingThumbnailsBySource = new Map<string, Set<string>>();

	for (const sourceId of sourceIds) {
		const cacheDir = getSourceCacheDir(sourceId);
		try {
			const files = await fs.readdir(cacheDir);
			const ids = new Set(files.map((f) => path.basename(f, path.extname(f))));
			existingThumbnailsBySource.set(sourceId, ids);
		} catch {
			existingThumbnailsBySource.set(sourceId, new Set());
		}
	}

	// サムネイルがないメディアを抽出
	const missingThumbnails = allMedia.filter((media) => {
		const existingIds = existingThumbnailsBySource.get(media.mediaSourceId);
		return !existingIds || !existingIds.has(media.id);
	});

	console.log(`📊 サムネイル未生成のメディア数: ${missingThumbnails.length}`);

	// URL が存在するものを抽出
	const targets = missingThumbnails.filter((m) => m.urls.length > 0);
	const noUrlTargets = missingThumbnails.filter((m) => m.urls.length === 0);

	console.log(`  - 再ダウンロード可能 (URLあり)  : ${targets.length} 件`);
	console.log(`  - 再ダウンロード不可 (URLなし)  : ${noUrlTargets.length} 件`);

	if (targets.length === 0) {
		console.log('⚠️ 再ダウンロード対象のメディアが見つかりませんでした。');
		return;
	}

	if (isDryRun) {
		console.log('\n--- 🧪 ドライランモード (実際にはダウンロードしません) ---');
		console.log('実際にダウンロードを実行するには、引数に `--execute` を指定してください:');
		console.log('  bun scripts/redownload-corrupted-media.ts --execute\n');

		console.log('📋 対象ファイル一覧:');
		for (const item of targets) {
			const basePath = sourcePathMap.get(item.mediaSourceId) || '';
			const absolutePath = path.join(basePath, item.filePath);
			console.log(`  - ID: ${item.id}`);
			console.log(`    ローカルパス: ${absolutePath}`);
			console.log(`    取得元 URL  : ${item.urls[0]}`);
		}
		return;
	}

	console.log(`\n🚀 ${targets.length} 件のファイルを再ダウンロード中...`);

	let completed = 0;
	await runWithLimit(targets, 5, async (item) => {
		const basePath = sourcePathMap.get(item.mediaSourceId);
		if (!basePath) {
			console.error(`❌ [ID: ${item.id}] ソースパスが見つかりません。`);
			return;
		}

		const absolutePath = path.join(basePath, item.filePath);
		const downloadUrl = item.urls[0]; // 最初のURLを使用

		try {
			// ディレクトリの存在確認
			await fs.mkdir(path.dirname(absolutePath), { recursive: true });

			console.log(`⏳ [${++completed}/${targets.length}] ダウンロード中: ${item.fileName}`);
			
			const response = await fetch(downloadUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// ファイルに上書き保存
			await fs.writeFile(absolutePath, buffer);
			console.log(`  ✅ 保存成功: ${absolutePath}`);
		} catch (error) {
			console.error(`  ❌ ダウンロード/書き込み失敗 [ID: ${item.id}]:`, error);
		}
	});

	console.log('\n🎉 すべての再ダウンロード処理が完了しました！');
}

main().catch((err) => {
	console.error('❌ エラーが発生しました:', err);
	process.exit(1);
});

import type { TransactionSQL } from "bun";
import type { mediaTags } from "./schema";

export type BackupMediaTagRow = typeof mediaTags.$inferSelect;

export async function copyBackupMediaTags(
	tx: TransactionSQL,
	rows: BackupMediaTagRow[],
): Promise<void> {
	await tx`
		CREATE TEMP TABLE backup_restore_media_tags ON COMMIT DROP AS
		SELECT media_id, tag_id, tag_type, confidence, source, NULL::bigint AS restore_order
		FROM media_tags WITH NO DATA
	`;

	const copy = tx`
		COPY pg_temp.backup_restore_media_tags
		(media_id, tag_id, tag_type, confidence, source, restore_order)
		FROM STDIN (FORMAT csv)
	`;
	const writer = copy.writable().getWriter();
	const completed = Promise.resolve(copy);
	// The server can reject the COPY while we are still writing to its stream.
	void completed.catch(() => {});
	try {
		const batchSize = 1_000;
		for (let offset = 0; offset < rows.length; offset += batchSize) {
			const csv = rows.slice(offset, offset + batchSize).map((row, index) => {
				const source = row.source.replaceAll('"', '""');
				return `${row.mediaId},${row.tagId},${row.tagType},${row.confidence ?? ""},"${source}",${offset + index}\n`;
			});
			await writer.write(csv.join(""));
		}
		await writer.close();
		await completed;
	} catch (error) {
		await writer.abort(error).catch(() => {});
		await completed.catch(() => {});
		throw error;
	} finally {
		writer.releaseLock();
	}

	// Insert in dump order so the first row for each key keeps its metadata.
	await tx`
		INSERT INTO media_tags (media_id, tag_id, tag_type, confidence, source)
		SELECT media_id, tag_id, tag_type, confidence, source
		FROM pg_temp.backup_restore_media_tags
		ORDER BY restore_order
		ON CONFLICT DO NOTHING
	`;
}

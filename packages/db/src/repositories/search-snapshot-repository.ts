import {
	type SearchSnapshotRepository,
	type SearchSnapshot,
	type SearchSnapshotState,
	searchSnapshotSchema,
	searchSnapshotStateSchema,
} from "@solid-imager/core/search";
import { eq } from "drizzle-orm";
import { searchSnapshots } from "../schema";
import type { DrizzleExecutor } from "../types";

function mapToEntity(row: typeof searchSnapshots.$inferSelect): SearchSnapshot {
	return searchSnapshotSchema.parse({
		id: row.id,
		version: row.version,
		fingerprint: row.fingerprint,
		state: searchSnapshotStateSchema.parse(row.state),
		createdAt: row.createdAt,
	});
}

export function createSearchSnapshotRepository(
	getExecutor: () => DrizzleExecutor,
): SearchSnapshotRepository {
	const getBy = async (
		column: typeof searchSnapshots.id | typeof searchSnapshots.fingerprint,
		value: string,
	): Promise<SearchSnapshot | null> => {
		const rows = await getExecutor()
			.select()
			.from(searchSnapshots)
			.where(eq(column, value))
			.limit(1);
		return rows[0] ? mapToEntity(rows[0]) : null;
	};

	return {
		get: (id) => getBy(searchSnapshots.id, id),
		getByFingerprint: (fingerprint) =>
			getBy(searchSnapshots.fingerprint, fingerprint),
		async create(data: {
			fingerprint: string;
			state: SearchSnapshotState;
		}): Promise<SearchSnapshot> {
			await getExecutor()
				.insert(searchSnapshots)
				.values({
					fingerprint: data.fingerprint,
					state: data.state,
					version: 1,
				})
				.onConflictDoNothing({ target: searchSnapshots.fingerprint });

			const snapshot = await getBy(
				searchSnapshots.fingerprint,
				data.fingerprint,
			);
			if (!snapshot) {
				throw new Error("Failed to create search snapshot");
			}
			return snapshot;
		},
	};
}

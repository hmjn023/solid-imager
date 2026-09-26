import { oc } from "@orpc/contract";
import {
	captureSearchSnapshotRequestSchema,
	captureSearchSnapshotResponseSchema,
	getSearchSnapshotRequestSchema,
	safeSearchSnapshotSchema,
} from "../search/history";

export const searchSnapshotsContract = {
	capture: oc
		.route({
			tags: ["Search Snapshots"],
			summary: "検索状態を履歴スナップショットとして保存",
			description:
				"現在の検索条件をブラウザ履歴から復元できるスナップショットとして保存し、スナップショットIDを返します。",
		})
		.input(captureSearchSnapshotRequestSchema)
		.output(captureSearchSnapshotResponseSchema),
	get: oc
		.route({
			tags: ["Search Snapshots"],
			summary: "検索履歴スナップショット取得",
			description:
				"スナップショットIDを指定して保存済みの検索条件を取得します。",
		})
		.input(getSearchSnapshotRequestSchema)
		.output(safeSearchSnapshotSchema),
};

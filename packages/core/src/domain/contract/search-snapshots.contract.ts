import { oc } from "@orpc/contract";
import {
	captureSearchSnapshotRequestSchema,
	captureSearchSnapshotResponseSchema,
	getSearchSnapshotRequestSchema,
	searchSnapshotSchema,
} from "../search/history";

export const searchSnapshotsContract = {
	capture: oc
		.input(captureSearchSnapshotRequestSchema)
		.output(captureSearchSnapshotResponseSchema),
	get: oc.input(getSearchSnapshotRequestSchema).output(searchSnapshotSchema),
};

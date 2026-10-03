import type { BulkActionDialogProps as SharedBulkActionDialogProps } from "@solid-imager/ui/bulk-action-dialog";
import { BulkActionDialog as SharedBulkActionDialog } from "@solid-imager/ui/bulk-action-dialog";
import {
	bulkCopyToSource,
	bulkDeleteMedia,
	bulkMoveMedia,
	bulkMoveToSource,
} from "~/infrastructure/api-clients/media-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type BulkActionDialogProps = Omit<
	SharedBulkActionDialogProps,
	| "listSources"
	| "bulkCopyToSource"
	| "bulkDeleteMedia"
	| "bulkMoveMedia"
	| "bulkMoveToSource"
>;

export function BulkActionDialog(props: BulkActionDialogProps) {
	return (
		<SharedBulkActionDialog
			{...props}
			bulkCopyToSource={bulkCopyToSource}
			bulkDeleteMedia={bulkDeleteMedia}
			bulkMoveMedia={bulkMoveMedia}
			bulkMoveToSource={bulkMoveToSource}
			listSources={fetchMediaSources}
		/>
	);
}

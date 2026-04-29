import { ImportReviewModal as SharedImportReviewModal } from "@solid-imager/ui/import-review-modal";
import {
	cancelPendingImports,
	listPendingImports,
	processPendingImports,
} from "~/infrastructure/api-clients/imports-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onImportCompleted: () => void;
};

export function ImportReviewModal(props: Props) {
	return (
		<SharedImportReviewModal
			cancelPending={cancelPendingImports}
			isOpen={props.isOpen}
			listPending={listPendingImports}
			listSources={fetchMediaSources}
			onClose={props.onClose}
			onImportCompleted={props.onImportCompleted}
			processPending={(jobIds, targetSourceId) =>
				processPendingImports(jobIds, targetSourceId)
			}
		/>
	);
}

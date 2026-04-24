import { ImportReviewModal as SharedImportReviewModal } from "@solid-imager/ui/import-review-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onImportCompleted: () => void;
};

export default function ImportReviewModal(props: Props) {
	return (
		<SharedImportReviewModal
			cancelPending={(jobIds) => orpc.imports.cancel({ jobIds })}
			isOpen={props.isOpen}
			listPending={() => orpc.imports.listPending()}
			listSources={() => orpc.sources.list()}
			onClose={props.onClose}
			onImportCompleted={props.onImportCompleted}
			processPending={(jobIds, targetSourceId) =>
				orpc.imports.process({ jobIds, targetSourceId })
			}
		/>
	);
}

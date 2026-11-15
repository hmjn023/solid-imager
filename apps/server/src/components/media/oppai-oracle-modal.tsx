import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import { OppaiOracleModal as SharedOppaiOracleModal } from "@solid-imager/ui/oppai-oracle-modal";
import { fetchOppaiOracleTags } from "~/infrastructure/api-clients/ai-api";

type OppaiOracleModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
	mediaType?: Media["mediaType"];
	onSuccess?: () => void;
};

export function OppaiOracleModal(props: OppaiOracleModalProps) {
	return (
		<SharedOppaiOracleModal
			mediaType={props.mediaType}
			onSuccess={props.onSuccess}
			fetchTags={async () => {
				const result = await fetchOppaiOracleTags({
					mediaSourceId: props.mediaSourceId,
					mediaId: props.mediaId,
				});
				if (!result) {
					throw new Error(t("oppaiOracleModal.noOppaiOracleResultReturned"));
				}
				return result;
			}}
			isOpen={props.isOpen}
			onClose={props.onClose}
		/>
	);
}

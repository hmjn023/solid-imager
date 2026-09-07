import { OppaiOracleModal as SharedOppaiOracleModal } from "@solid-imager/ui/oppai-oracle-modal";
import { fetchOppaiOracleTags } from "~/infrastructure/api-clients/ai-api";

type OppaiOracleModalProps = {
	isOpen: boolean;
	onClose: () => void;
	mediaSourceId: string;
	mediaId: string;
};

export function OppaiOracleModal(props: OppaiOracleModalProps) {
	return (
		<SharedOppaiOracleModal
			description="Tags extracted from the image using the OppaiOracle model."
			fetchTags={() =>
				fetchOppaiOracleTags({
					mediaId: props.mediaId,
					mediaSourceId: props.mediaSourceId,
				})
			}
			isOpen={props.isOpen}
			onClose={props.onClose}
		/>
	);
}

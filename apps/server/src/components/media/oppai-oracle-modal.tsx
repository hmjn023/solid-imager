import { OppaiOracleModal as SharedOppaiOracleModal } from "@solid-imager/ui/oppai-oracle-modal";
import { fetchOppaiOracleTags } from "~/infrastructure/api-clients/ai-api";

type OppaiOracleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mediaSourceId: string;
  mediaId: string;
  onSuccess?: () => void;
};

export function OppaiOracleModal(props: OppaiOracleModalProps) {
  return (
    <SharedOppaiOracleModal
      description="Tags extracted from the image using the OppaiOracle model."
      onSuccess={props.onSuccess}
      fetchTags={async () => {
        const result = await fetchOppaiOracleTags({
          mediaSourceId: props.mediaSourceId,
          mediaId: props.mediaId,
        });
        if (!result) {
          throw new Error("No OppaiOracle result returned");
        }
        return result;
      }}
      isOpen={props.isOpen}
      onClose={props.onClose}
    />
  );
}

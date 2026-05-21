import { AiTaggingModal as SharedAiTaggingModal } from "@solid-imager/ui/ai-tagging-modal";
import { serverOrpc } from "~/infrastructure/api-clients/server-orpc-client";

type AiTaggingModalProps = {
	isOpen: boolean;
	onClose: () => void;
	fileName: string;
	loadFile: () => Promise<File>;
};

export function AiTaggingModal(props: AiTaggingModalProps) {
	return (
		<SharedAiTaggingModal
			description={`Tags extracted from ${props.fileName} using the AI service.`}
			fetchTags={async () => {
				const file = await props.loadFile();
				return serverOrpc.ai.tag({ file });
			}}
			isOpen={props.isOpen}
			onClose={props.onClose}
		/>
	);
}

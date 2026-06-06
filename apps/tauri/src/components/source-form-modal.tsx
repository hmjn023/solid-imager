import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { SourceFormModal as SharedSourceFormModal } from "@solid-imager/ui/source-form-modal";

type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: unknown) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
};

export function SourceFormModal(props: SourceFormModalProps) {
	return (
		<SharedSourceFormModal
			editingSource={props.editingSource}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onSubmit={props.onSubmit}
		/>
	);
}

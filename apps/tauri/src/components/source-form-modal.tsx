import type { MediaSourceInfo, SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import {
	SourceFormModal as SharedSourceFormModal,
	type SourceFormData,
} from "@solid-imager/ui/source-form-modal";

type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: unknown) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
};

const validateLocalSource = (data: SourceFormData) => {
	const errors: Record<string, string> = {};
	if (!data.name.trim()) {
		errors.name = "Name is required";
	}
	if (!data.connectionInfo.path) {
		errors.path = "Path is required";
	}
	return errors;
};

export function SourceFormModal(props: SourceFormModalProps) {
	return (
		<SharedSourceFormModal
			description="Tauri currently supports local filesystem sources only."
			editingSource={props.editingSource}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onSubmit={props.onSubmit}
			sourceTypes={["local"]}
			submitLabel={props.editingSource ? "Save Changes" : "Create Source"}
			validationRules={validateLocalSource}
		/>
	);
}

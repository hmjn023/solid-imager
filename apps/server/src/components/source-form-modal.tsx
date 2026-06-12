import {
	SourceFormModal as SharedSourceFormModal,
	type SourceFormModalProps,
} from "@solid-imager/ui/source-form-modal";

export default function SourceFormModal(props: SourceFormModalProps) {
	return <SharedSourceFormModal {...props} />;
}

export type { SourceFormModalProps };

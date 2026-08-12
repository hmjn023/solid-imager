import {
	LegacySourceFormModal as SharedSourceFormModal,
	type SourceFormModalProps,
} from "@solid-imager/ui/legacy-source-form-modal";

export default function SourceFormModal(props: SourceFormModalProps) {
	return <SharedSourceFormModal {...props} />;
}

export type { SourceFormModalProps };

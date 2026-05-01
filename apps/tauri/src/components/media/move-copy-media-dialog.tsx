import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { MoveCopyMediaDialog as SharedMoveCopyMediaDialog } from "@solid-imager/ui/move-copy-media-dialog";
import { createResource } from "solid-js";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type MoveCopyMediaDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "copy" | "move";
	onConfirm: (targetSourceId: string) => void;
	currentSourceId: string;
};

export function MoveCopyMediaDialog(props: MoveCopyMediaDialogProps) {
	const [sources] = createResource<SafeMediaSource[], boolean>(
		() => props.open,
		async (isOpen) => {
			if (!isOpen) {
				return [];
			}
			return fetchMediaSources();
		},
	);

	const sourceOptions = () =>
		(sources() || []).flatMap((s) => (s.id ? [{ id: s.id, name: s.name }] : []));

	return (
		<SharedMoveCopyMediaDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			mode={props.mode}
			currentSourceId={props.currentSourceId}
			sources={sourceOptions()}
			isLoading={sources.loading}
			error={sources.error ? "Failed to load sources." : null}
			onConfirm={props.onConfirm}
		/>
	);
}

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
			return await fetchMediaSources();
		},
		{ initialValue: [] },
	);

	return (
		<SharedMoveCopyMediaDialog
			currentSourceId={props.currentSourceId}
			error={sources.error ? "Failed to load sources." : null}
			isLoading={sources.loading}
			mode={props.mode}
			onConfirm={props.onConfirm}
			onOpenChange={props.onOpenChange}
			open={props.open}
			sources={(sources() ?? []).filter(
				(s): s is SafeMediaSource & { id: string } => !!s.id,
			)}
		/>
	);
}

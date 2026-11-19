import {
	MoveCopyMediaDialog as SharedMoveCopyMediaDialog,
	type MoveCopyMediaDialogProps,
} from "@solid-imager/ui/move-copy-media-dialog";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

export function MoveCopyMediaDialog(
	props: Omit<MoveCopyMediaDialogProps, "listSources">,
) {
	return (
		<SharedMoveCopyMediaDialog {...props} listSources={fetchMediaSources} />
	);
}

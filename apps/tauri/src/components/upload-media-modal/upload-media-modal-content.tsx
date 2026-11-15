import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { t } from "@solid-imager/i18n";
import { UploadMediaModalContent as SharedUploadMediaModalContent } from "@solid-imager/ui/upload-media-modal-content";

type UploadMediaModalProps = {
	sourceId?: string;
	isOpen: boolean;
	onClose: () => void;
	onUpload: (options: {
		file: File;
		reservationId?: string;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	}) => Promise<void>;
	initialFile: File | null;
	pastedUrl: string | null;
};

async function fetchFileFromUrl(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			t("uploadMediaModalContent.failedToFetchURLValue", {
				value0: String(response.status),
			}),
		);
	}
	const blob = await response.blob();
	return new File(
		[blob],
		url.substring(url.lastIndexOf("/") + 1) || "fetched-image",
		{
			type: blob.type,
		},
	);
}

export function UploadMediaModalContent(props: UploadMediaModalProps) {
	const reserveUploads = () => {
		const sourceId = props.sourceId;
		if (!sourceId) return undefined;
		return async (filenames: string[]) => {
			const { reservations } = await orpc.media.reserveUploads({
				sourceId,
				filenames,
			});
			return reservations;
		};
	};
	return (
		<SharedUploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={fetchFileFromUrl}
			reserveUploads={reserveUploads()}
			onUpload={props.onUpload}
			pastedUrl={props.pastedUrl}
		/>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

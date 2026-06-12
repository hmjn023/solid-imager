import { UploadMediaModalContent } from "@solid-imager/ui/upload-media-modal-content";
import { fetchFromUrl } from "~/infrastructure/api-clients/fetch-url-api";

type UploadMediaModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onUpload: (options: {
		file: File;
		filename: string;
		description: string;
		sourceUrl?: string;
		overwrite: boolean;
		autoIncrement: boolean;
	}) => Promise<void>;
	initialFile: File | null;
	onUrlFetch: (file: File) => void;
	pastedUrl: string | null;
};

export function UploadMediaModal(props: UploadMediaModalProps) {
	return (
		<UploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={async (url) => {
				const blob = await fetchFromUrl(url);
				return new File([blob], "fetched-file", { type: blob.type });
			}}
			onUpload={props.onUpload}
			onUrlFetch={props.onUrlFetch}
			pastedUrl={props.pastedUrl}
		/>
	);
}

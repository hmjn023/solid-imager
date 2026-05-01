import {
	UploadMediaModalContent as SharedUploadMediaModalContent,
	UploadMediaModal,
} from "@solid-imager/ui/upload-media-modal-content";

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

async function fetchFileFromUrl(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch URL: ${response.status}`);
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
	return (
		<SharedUploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={fetchFileFromUrl}
			onUrlFetch={props.onUrlFetch}
			onUpload={props.onUpload}
			pastedUrl={props.pastedUrl}
		/>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

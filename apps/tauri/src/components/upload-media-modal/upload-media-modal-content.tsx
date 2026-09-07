import { V2UploadMediaModalContent } from "@solid-imager/ui/v2-upload-media-modal";

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
		<V2UploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={fetchFileFromUrl}
			onFilesSelected={() => undefined}
			onUploadStart={async (options) => {
				for (const file of options.files) {
					await props.onUpload({
						autoIncrement: options.autoIncrement,
						description: options.description,
						file,
						filename: options.filename || file.name,
						overwrite: options.overwrite,
						sourceUrl: options.sourceUrl,
					});
				}
			}}
			pastedUrl={props.pastedUrl}
		/>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

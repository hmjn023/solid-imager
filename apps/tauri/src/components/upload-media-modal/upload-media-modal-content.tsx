import {
	UploadMediaModalContent as SharedUploadMediaModalContent,
	type UploadMediaModalSubmitOptions,
} from "@solid-imager/ui/upload-media-modal";

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
	const handleUploadStart = async (options: UploadMediaModalSubmitOptions) => {
		for (const [index, file] of options.files.entries()) {
			await props.onUpload({
				file,
				filename: index === 0 ? options.filename : file.name,
				description: options.description,
				sourceUrl: index === 0 ? options.sourceUrl : undefined,
				overwrite: options.overwrite,
				autoIncrement: options.autoIncrement,
			});
		}
	};

	return (
		<SharedUploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={fetchFileFromUrl}
			onFilesSelected={(files) => {
				const firstFile = files[0];
				if (firstFile) {
					props.onUrlFetch(firstFile);
				}
			}}
			onUploadStart={handleUploadStart}
			pastedUrl={props.pastedUrl}
		/>
	);
}

export { UploadMediaModalContent as UploadMediaModal };

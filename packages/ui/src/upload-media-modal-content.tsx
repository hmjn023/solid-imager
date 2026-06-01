import {
	UploadMediaModalContent as SharedUploadMediaModalContent,
	type UploadMediaModalSubmitOptions,
} from "./upload-media-modal";

type UploadMediaModalContentProps = {
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
	onFetchUrl: (url: string) => Promise<File>;
};

export function UploadMediaModalContent(props: UploadMediaModalContentProps) {
	const handleUploadStart = async (options: UploadMediaModalSubmitOptions) => {
		await Promise.all(
			options.files.map((file, index) =>
				props.onUpload({
					file,
					filename: index === 0 ? options.filename : file.name,
					description: options.description,
					sourceUrl: index === 0 ? options.sourceUrl : undefined,
					overwrite: options.overwrite,
					autoIncrement: options.autoIncrement,
				}),
			),
		);
	};

	return (
		<SharedUploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={props.onFetchUrl}
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

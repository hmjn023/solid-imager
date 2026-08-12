import {
	LegacyUploadMediaModalContent as SharedUploadMediaModalContent,
	type UploadMediaModalSubmitOptions,
} from "./legacy-upload-media-modal";
import type { UploadMediaModalContentProps } from "./upload-media-modal-content.types";

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

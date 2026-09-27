import { UploadMediaModalContent } from "@solid-imager/ui/upload-media-modal-content";
import { fetchFromUrl } from "~/infrastructure/api-clients/fetch-url-api";

function getFetchedFilename(url: string, type: string) {
	const pathname = new URL(url).pathname;
	const filename = pathname.split("/").pop();
	if (filename) {
		try {
			return decodeURIComponent(filename);
		} catch {
			return filename;
		}
	}
	const subtype = type.split("/")[1]?.split(";")[0];
	const extension =
		type === "image/jpeg" ? "jpg" : subtype?.replace(/[^a-z0-9]/gi, "");
	return extension ? `download.${extension}` : "download";
}

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
				return new File([blob], getFetchedFilename(url, blob.type), {
					type: blob.type,
				});
			}}
			onUpload={props.onUpload}
			onUrlFetch={props.onUrlFetch}
			pastedUrl={props.pastedUrl}
		/>
	);
}

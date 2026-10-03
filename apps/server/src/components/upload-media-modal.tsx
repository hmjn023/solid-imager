import { UploadMediaModalContent } from "@solid-imager/ui/upload-media-modal-content";
import { fetchFromUrl } from "~/infrastructure/api-clients/fetch-url-api";

function getFetchedFilename(url: string, type: string) {
	const parsedUrl = new URL(url);
	const pathFilename = parsedUrl.pathname.split("/").pop();
	let filename = pathFilename;
	if (filename) {
		try {
			filename = decodeURIComponent(filename);
		} catch {
			// Keep the encoded name if it is not valid percent encoding.
		}
	}

	const normalizedType = type.split(";")[0]?.toLowerCase();
	const [typeGroup, rawSubtype] = normalizedType?.split("/") ?? [];
	const subtype = rawSubtype?.split("+")[0];
	const extensionFromType =
		normalizedType === "image/jpeg"
			? "jpg"
			: typeGroup === "image" || typeGroup === "video" || typeGroup === "audio"
				? subtype?.replace(/[^a-z0-9]/gi, "")
				: undefined;
	const extensionFromUrl = parsedUrl.searchParams
		.get("format")
		?.replace(/[^a-z0-9]/gi, "");
	const extension = extensionFromType || extensionFromUrl;
	if (!filename) {
		return extension ? `download.${extension}` : "download";
	}
	return /\.[^./\\]+$/.test(filename) || !extension
		? filename
		: `${filename}.${extension}`;
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

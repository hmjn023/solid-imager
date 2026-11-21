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
	initialFiles?: File[];
	pastedUrl: string | null;
};

function getFetchedFilename(url: string, type: string) {
	let filename: string | undefined;
	try {
		const parsedUrl = new URL(url, "http://localhost");
		filename = parsedUrl.pathname.split("/").pop();
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
				: typeGroup === "image" ||
					  typeGroup === "video" ||
					  typeGroup === "audio"
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
	} catch {
		return url.substring(url.lastIndexOf("/") + 1) || "fetched-image";
	}
}

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
	return new File([blob], getFetchedFilename(url, blob.type), {
		type: blob.type,
	});
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
			initialFiles={props.initialFiles}
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

import { asyncPool, isRecord } from "@solid-imager/core/utils";
import { t } from "@solid-imager/i18n";
import {
	UploadMediaModalContent as SharedUploadMediaModalContent,
	type UploadMediaModalSubmitOptions,
} from "./upload-media-modal";
import type { UploadMediaModalContentProps } from "./upload-media-modal-content.types";

export function UploadMediaModalContent(props: UploadMediaModalContentProps) {
	const handleUploadStart = async (options: UploadMediaModalSubmitOptions) => {
		const reservations =
			options.files.length > 1 && props.reserveUploads
				? await props.reserveUploads(
						options.files.map((file, index) =>
							index === 0 ? options.filename : file.name,
						),
					)
				: [];
		// Reserve the entire batch first, then bound the number of request bodies in memory.
		const uploads = options.files.map((file, index) => ({
			file,
			reservationId: reservations[index],
			filename: index === 0 ? options.filename : file.name,
			description: options.description,
			sourceUrl: index === 0 ? options.sourceUrl : undefined,
			overwrite: options.overwrite,
			autoIncrement: options.autoIncrement,
		}));
		let cancelled = false;
		const results = await asyncPool(uploads, 3, async (upload) => {
			if (cancelled) return;
			try {
				await props.onUpload(upload);
			} catch (error) {
				if (
					upload.reservationId &&
					isRecord(error) &&
					error.code === "BATCH_CANCELLED"
				) {
					cancelled = true;
					return;
				}
				throw error;
			}
		});
		if (cancelled)
			throw new Error(t("managerBatchState.batchOperationCancelled"));
		const failure = results.find((result) => result.status === "rejected");
		if (failure) throw failure.reason;
	};

	return (
		<SharedUploadMediaModalContent
			initialFile={props.initialFile}
			isOpen={props.isOpen}
			onClose={props.onClose}
			onFetchUrl={props.onFetchUrl}
			onUploadStart={handleUploadStart}
			pastedUrl={props.pastedUrl}
		/>
	);
}

export type { UploadMediaModalContentProps } from "./upload-media-modal-content.types";

import type { CcipVectorStatus } from "@solid-imager/core/tagging";
import { t, type StaticMessageKey } from "@solid-imager/i18n";

const JOB_TYPE_KEYS: Record<string, StaticMessageKey | undefined> = {
	processMedia: "jobTypes.processMedia",
	downloadImage: "jobTypes.downloadImage",
	auto_tagging: "jobTypes.auto_tagging",
	extract_ccip_vector: "jobTypes.extract_ccip_vector",
	extract_embedding_vector: "jobTypes.extract_embedding_vector",
	extract_embedding_batch: "jobTypes.extract_embedding_batch",
	batch_ccip_parent: "jobTypes.batch_ccip_parent",
	bulk_tagging_parent: "jobTypes.bulk_tagging_parent",
	thumbnail_generation_parent: "jobTypes.thumbnail_generation_parent",
	generate_thumbnail: "jobTypes.generate_thumbnail",
	character_clustering: "jobTypes.character_clustering",
	source_export: "jobTypes.source_export",
	source_restore: "jobTypes.source_restore",
	import_request: "jobTypes.import_request",
};

export function jobTypeLabel(type: string): string {
	const key = JOB_TYPE_KEYS[type];
	return key ? t(key) : t("jobTypes.unknown", { type });
}

export function mediaTypeLabel(type: string): string {
	switch (type) {
		case "image":
			return t("labels.media.image");
		case "video":
			return t("labels.media.video");
		case "audio":
			return t("labels.media.audio");
		default:
			return t("status.unknown");
	}
}

export function sourceTypeLabel(type: string): string {
	switch (type) {
		case "local":
			return t("labels.local");
		case "sftp":
			return t("sourceFormModal.sFTP");
		case "s3":
			return t("sourceFormModal.s3CompatibleStorage");
		default:
			return t("status.unknown");
	}
}

export function ccipStatusLabel(status: CcipVectorStatus["status"]): string {
	const keys = {
		missing: "ccipStatus.missing",
		processing: "ccipStatus.processing",
		ready: "ccipStatus.ready",
		stale: "ccipStatus.stale",
		failed: "status.failed",
	} as const;
	return t(keys[status]);
}

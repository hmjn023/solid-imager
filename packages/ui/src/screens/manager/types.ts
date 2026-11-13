import { t } from "@solid-imager/i18n";
import type { ManagerEntityType } from "../../hooks/use-manager-page";

export type ManagerCategoryValue =
	| ManagerEntityType
	| "transfer"
	| "authors"
	| "clustering";

export type ManagerCategory = {
	description: string;
	group: "Entities" | "Tools";
	label: string;
	value: ManagerCategoryValue;
};

export type ManagerTransferFormat = "ndjson" | "tar";

export type ManagerTransferActions = {
	exportSource: (input: {
		format: ManagerTransferFormat;
		includeImages: boolean;
		sourceId: string;
	}) => Promise<{ fileName: string; jobId: string }>;
	downloadExport: (input: { fileName: string; jobId: string }) => Promise<void>;
	importSource: (input: {
		file: File;
		format: ManagerTransferFormat;
		sourceId: string;
	}) => Promise<{ importedCount?: number; jobId?: string }>;
};

export const MANAGER_CATEGORIES: ManagerCategory[] = [
	{
		description: t("types.reviewAnalysisNoiseAndDifferencesBetweenSettings"),
		group: "Tools",
		label: t("jobTypes.character_clustering"),
		value: "clustering",
	},
	{
		description: t("types.reviewReassignAndMergeIncorrectRegistrations"),
		group: "Entities",
		label: t("types.authorsAndExternalAccounts"),
		value: "authors",
	},
	{
		description: t("types.collectionsAndWork"),
		group: "Entities",
		label: t("labels.projects"),
		value: "projects",
	},
	{
		description: t("types.seriesAndFranchises"),
		group: "Entities",
		label: t("labels.ips"),
		value: "ips",
	},
	{
		description: t("types.peopleAndSubjects"),
		group: "Entities",
		label: t("labels.characters"),
		value: "characters",
	},
	{
		description: t("types.submitAITagJobs"),
		group: "Tools",
		label: t("jobTypes.bulk_tagging_parent"),
		value: "tagging",
	},
	{
		description: t("types.buildImageOrCharacterEmbeddings"),
		group: "Tools",
		label: t("types.vectorExtraction"),
		value: "vectors",
	},
	{
		description: t("types.warmResponsiveImageCache"),
		group: "Tools",
		label: t("types.thumbnails"),
		value: "thumbnails",
	},
	{
		description: t("types.reviewMatchingMedia"),
		group: "Tools",
		label: t("types.duplicates"),
		value: "duplicates",
	},
	{
		description: t("types.exportAndRestoreSourceData"),
		group: "Tools",
		label: t("types.dataTransfer"),
		value: "transfer",
	},
];

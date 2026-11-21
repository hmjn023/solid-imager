import { t } from "@solid-imager/i18n";
import type { DuplicateGroup } from "@solid-imager/core/media";
import type { ManagerEntityType } from "../../hooks/use-manager-page";

export type ManagerCategoryValue =
	| ManagerEntityType
	| "transfer"
	| "authors"
	| "clustering"
	| "tagDictionary";

export type ManagerCategory = {
	description: string;
	group: "Entities" | "Tools";
	label: string;
	value: ManagerCategoryValue;
};

export type ManagerTransferFormat = "ndjson" | "tar";

export type DuplicateToolActions = {
	thumbnailUrl: (
		item: DuplicateGroup["media"][number],
	) => string | Promise<string>;
	releaseThumbnailUrl?: (url: string) => void;
	openMedia?: (mediaSourceId: string, mediaId: string) => void;
};

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
		get description() {
			return t("tagDictionary.navigationDescription");
		},
		group: "Entities",
		get label() {
			return t("tagDictionary.title");
		},
		value: "tagDictionary",
	},
	{
		get description() {
			return t("types.reviewAnalysisNoiseAndDifferencesBetweenSettings");
		},
		group: "Tools",
		get label() {
			return t("jobTypes.character_clustering");
		},
		value: "clustering",
	},
	{
		get description() {
			return t("types.reviewReassignAndMergeIncorrectRegistrations");
		},
		group: "Entities",
		get label() {
			return t("types.authorsAndExternalAccounts");
		},
		value: "authors",
	},
	{
		get description() {
			return t("types.collectionsAndWork");
		},
		group: "Entities",
		get label() {
			return t("labels.projects");
		},
		value: "projects",
	},
	{
		get description() {
			return t("types.seriesAndFranchises");
		},
		group: "Entities",
		get label() {
			return t("labels.ips");
		},
		value: "ips",
	},
	{
		get description() {
			return t("types.peopleAndSubjects");
		},
		group: "Entities",
		get label() {
			return t("labels.characters");
		},
		value: "characters",
	},
	{
		get description() {
			return t("types.submitAITagJobs");
		},
		group: "Tools",
		get label() {
			return t("jobTypes.bulk_tagging_parent");
		},
		value: "tagging",
	},
	{
		get description() {
			return t("types.buildImageOrCharacterEmbeddings");
		},
		group: "Tools",
		get label() {
			return t("types.vectorExtraction");
		},
		value: "vectors",
	},
	{
		get description() {
			return t("types.warmResponsiveImageCache");
		},
		group: "Tools",
		get label() {
			return t("types.thumbnails");
		},
		value: "thumbnails",
	},
	{
		get description() {
			return t("types.reviewMatchingMedia");
		},
		group: "Tools",
		get label() {
			return t("types.duplicates");
		},
		value: "duplicates",
	},
	{
		get description() {
			return t("types.exportAndRestoreSourceData");
		},
		group: "Tools",
		get label() {
			return t("types.dataTransfer");
		},
		value: "transfer",
	},
];

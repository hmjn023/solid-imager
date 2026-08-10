import type { ManagerEntityType } from "../../hooks/use-manager-page";

export type V2ManagerCategory = ManagerEntityType | "transfer";

export type ManagerCategory = {
	description: string;
	group: "Entities" | "Tools";
	label: string;
	value: V2ManagerCategory;
};

export type V2ManagerTransferFormat = "ndjson" | "tar" | "lancedb";

export type V2ManagerTransferActions = {
	exportSource: (input: {
		format: V2ManagerTransferFormat;
		includeImages: boolean;
		sourceId: string;
	}) => Promise<void>;
	importSource: (input: {
		file: File;
		format: V2ManagerTransferFormat;
		sourceId: string;
	}) => Promise<{ importedCount?: number; jobId?: string }>;
};

export const MANAGER_CATEGORIES: ManagerCategory[] = [
	{
		description: "Collections and work",
		group: "Entities",
		label: "Projects",
		value: "projects",
	},
	{
		description: "Series and franchises",
		group: "Entities",
		label: "IPs",
		value: "ips",
	},
	{
		description: "People and subjects",
		group: "Entities",
		label: "Characters",
		value: "characters",
	},
	{
		description: "Submit AI tag jobs",
		group: "Tools",
		label: "Batch tagging",
		value: "tagging",
	},
	{
		description: "Build CCIP features",
		group: "Tools",
		label: "Vector extraction",
		value: "vectors",
	},
	{
		description: "Warm responsive image cache",
		group: "Tools",
		label: "Thumbnails",
		value: "thumbnails",
	},
	{
		description: "Review matching media",
		group: "Tools",
		label: "Duplicates",
		value: "duplicates",
	},
	{
		description: "Export and restore source data",
		group: "Tools",
		label: "Data transfer",
		value: "transfer",
	},
];

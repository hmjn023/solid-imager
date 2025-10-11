/**
 * Shared Domain Types
 * Cross-domain types used across multiple domains
 * Extracted from src/lib/types.ts during architecture reorganization
 */

export type UUID = string;

export type AppConfig = {
	server?: {
		port?: number;
		host?: string;
	};
	media?: {
		supportedFormats?: string[];
		thumbnailSizes?: number[];
		cacheDirectory?: string;
		autoGenerate?: boolean;
		maxConcurrentJobs?: number;
	};
	upload?: {
		maxFileSize?: number;
		allowOverwrite?: boolean;
	};
	[key: string]: unknown;
};

export type SearchOptions = {
	tags?: string[];
	filename?: string;
	dateRange?: {
		from?: Date;
		to?: Date;
	};
	// Add other search parameters as needed, e.g., for metadata
	[key: string]: any;
};

export type ImportData = {
	url?: string;
	file?: File;
	data?: any; // For direct data payload
};

export type UserData = {
	name: string;
	email: string;
	password?: string;
};

export type CollectionData = {
	userId: UUID;
	name: string;
	description?: string;
};

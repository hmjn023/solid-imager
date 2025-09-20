export type mediaSourceTypeEnum = "local" | "sftp" | "s3";

export type connectionInfo = localConnetionInfo;

export type localConnetionInfo = {
	path: string;
};

export type mediaSourceInfo = {
	name: string;
	description: string;
	type: mediaSourceTypeEnum;
	connectionInfo: connectionInfo;
};

export type AppConfig = Record<string, unknown>;

export type MediaUpdateData = Record<string, unknown>;

export type MediaSearchParams = Record<string, string | number | boolean>;

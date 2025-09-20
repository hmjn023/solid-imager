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

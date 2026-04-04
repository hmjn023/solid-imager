export type DownloadBackendKind = "local" | "remote" | "unsupported";

export type DownloadBackendCapabilities = {
	kind: DownloadBackendKind;
	supportsMetadata: boolean;
	supportsDownload: boolean;
};

export type DownloadBackendDownloadResult<TMetadata> = Array<{
	filePath: string;
	metadata: TMetadata;
}>;

export type IDownloadBackend<TMetadata = unknown> = {
	getCapabilities(): DownloadBackendCapabilities;
	fetchMetadata(
		url: string,
		cookies?: unknown[],
		userAgent?: string,
	): Promise<TMetadata | null>;
	download(
		url: string,
		outputDir: string,
		cookies?: unknown[],
		userAgent?: string,
	): Promise<DownloadBackendDownloadResult<TMetadata>>;
};

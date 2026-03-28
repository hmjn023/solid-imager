export type IImageProcessor = {
	generateThumbnail(
		mediaPath: string,
		outputPath: string,
		size: number,
		quality: number,
	): Promise<void>;

	extractMetadata(mediaPath: string): Promise<{
		tags: { name: string; type: "positive" | "negative" }[];
		prompt: unknown;
		workflow: unknown;
	}>;

	getDimensions(mediaPath: string): Promise<{ width: number; height: number }>;
};

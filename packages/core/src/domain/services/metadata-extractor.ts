export type ExtractedMediaMetadata = {
	tags: { name: string; type: "positive" | "negative" }[];
	prompt: unknown;
	workflow: unknown;
};

export type IMetadataExtractor = {
	extract(mediaPath: string): Promise<ExtractedMediaMetadata>;
};

export type IThumbnailGenerator = {
	generate(
		mediaPath: string,
		outputPath: string,
		size: number,
		quality: number,
	): Promise<void>;
};

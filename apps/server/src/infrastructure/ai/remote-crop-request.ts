export function createRemoteCropRequest(
	fileBuffer: Uint8Array,
	fileName: string,
	transparent: boolean,
): { file: File; transparent: boolean } {
	return {
		file: new File([Uint8Array.from(fileBuffer).buffer], fileName),
		transparent,
	};
}

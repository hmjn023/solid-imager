import { z } from "zod";

export function binaryResponseBody(mediaType: string) {
	return z.instanceof(ReadableStream<Uint8Array>).meta({
		type: "string",
		format: "binary",
		contentMediaType: mediaType,
	});
}

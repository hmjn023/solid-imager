import { Readable } from "node:stream";

/**
 * Convert a Node.js Readable stream to a Web ReadableStream.
 * Bridges the type incompatibility between Node and Web stream types.
 */
export function nodeStreamToWebReadable(
	nodeStream: Readable,
): ReadableStream<Uint8Array> {
	return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

/**
 * Convert a Web ReadableStream to a Node.js Readable stream.
 */
export function webReadableToNodeStream(
	webStream: ReadableStream<Uint8Array>,
): Readable {
	return Readable.fromWeb(webStream as any);
}

/**
 * Convert a Node.js Buffer or Uint8Array to a Web BodyInit.
 * Bridges the type incompatibility between Node Buffer and Web BodyInit.
 */
export function bufferToBodyInit(buffer: Uint8Array): BodyInit {
	return buffer as unknown as BodyInit;
}

export function ensureWebReadableStream(
	result: Readable | ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
	return result instanceof Readable
		? nodeStreamToWebReadable(result)
		: result;
}

export function asDumpStream(
	result: unknown,
): ReadableStream<Uint8Array> {
	if (result instanceof Readable) {
		return nodeStreamToWebReadable(result);
	}
	if (result instanceof ReadableStream) {
		return result;
	}
	throw new Error("Expected a stream result from dump");
}

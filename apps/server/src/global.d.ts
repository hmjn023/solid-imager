/// <reference types="@tanstack/solid-start/env" />

declare module "*?url" {
	const content: string;
	export default content;
}

declare module "*.css" {
	const content: string;
	export default content;
}

declare module "png-chunks-extract" {
	export interface Chunk {
		name: string;
		data: Uint8Array;
	}
	export default function extract(data: Uint8Array | Buffer): Chunk[];
}

declare module "png-chunk-text" {
	export interface TextChunk {
		keyword: string;
		text: string;
	}
	export function decode(data: Uint8Array): TextChunk;
	export function encode(keyword: string, text: string): Uint8Array;
}

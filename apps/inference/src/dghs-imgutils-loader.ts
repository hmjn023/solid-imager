import { createRequire } from "node:module";

export type DghsImgutilsModule = typeof import("dghs-imgutils-rs");

const require = createRequire(import.meta.url);

export function resolveDghsImgutilsPath(): string {
	return require.resolve("dghs-imgutils-rs");
}

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type DghsImgutilsModule = typeof import("dghs-imgutils-rs");

const require = createRequire(import.meta.url);
const bundledModulePath = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"_libs",
	"dghs-imgutils-rs",
	"index.js",
);

let cachedModule: DghsImgutilsModule | undefined;

export function loadDghsImgutils(): DghsImgutilsModule {
	if (cachedModule) return cachedModule;

	const modulePath = existsSync(bundledModulePath)
		? bundledModulePath
		: "dghs-imgutils-rs";
	// The package is loaded from a runtime-selected path, so its declaration is the boundary contract.
	const loadedModule = require(modulePath) as DghsImgutilsModule;
	cachedModule = loadedModule;
	return loadedModule;
}

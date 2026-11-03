import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";

const resolve = createRequire(import.meta.url).resolve;
const packages = new URL("../../../../../../packages/", import.meta.url);
const privateSubpaths = {
	application: [
		"services/media-query-service",
		"services/media-transfer-service",
		"services/media-upload-service",
		"services/media-service",
		"ports/media-service",
		"utils/sparse-hdbscan",
	],
	client: ["src/create-client"],
	core: ["domain/search/schema", "domain/repositories/job-repository"],
	db: [
		"repositories/media-repository",
		"repositories/media-repository-utils",
		"src/schema",
	],
	ui: [
		"stores/search-store",
		"screens/manager/types",
		"screens/source-media",
		"sort-controls",
		"shortcuts/preferences-storage",
		"src/button",
	],
};

describe.each(Object.entries(privateSubpaths))(
	"%s package boundary",
	(name, privatePaths) => {
		const root = new URL(name + "/", packages);

		it("resolves each declared public entry to its source", () => {
			const manifest: { exports: Record<string, string> } = JSON.parse(
				readFileSync(new URL("package.json", root), "utf8"),
			);
			for (const [entry, target] of Object.entries(manifest.exports)) {
				expect(entry).not.toContain("*");
				const specifier = "@solid-imager/" + name + entry.slice(1);
				expect(resolve(specifier)).toBe(fileURLToPath(new URL(target, root)));
			}
		});

		it.each(privatePaths)("rejects the internal import %s", (subpath) => {
			expect(() => resolve(`@solid-imager/${name}/${subpath}`)).toThrow(
				expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
			);
		});
	},
);

it.each([
	"@solid-imager/cli/src/index.ts",
	"@solid-imager/server/app-router",
	"@solid-imager/server/src/infrastructure/api/app-router.ts",
	"@solid-imager/tauri/src/main.tsx",
	"xtracter/src/api.ts",
])("keeps the application entry %s out of the library API", (specifier) => {
	expect(() => resolve(specifier)).toThrow(
		expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
	);
});

it("keeps internal helpers out of public types", () => {
	type Shortcuts = typeof import("@solid-imager/ui/shortcuts");
	type Repositories = ReturnType<
		typeof import("@solid-imager/db").createRepositories
	>;
	expectTypeOf<
		keyof Shortcuts
	>().toEqualTypeOf<"ShortcutPreferencesProvider">();
	expectTypeOf<Extract<keyof Repositories, "mediaSearch">>().toBeNever();
});

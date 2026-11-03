import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "./workspace-imports.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const apps = fileURLToPath(new URL("../apps/", import.meta.url));
const config = path.join(apps, "tauri", "tailwind.config.js");
const cli = path.join(apps, "cli", "src", "consumer.ts");
new RuleTester().run(
	"workspace/public-imports",
	plugin.rules["public-imports"],
	{
		valid: [
			{
				filename: config,
				code: 'import preset from "@solid-imager/ui/tailwind-preset";',
			},
			{
				filename: cli,
				code: 'export type { AppContract } from "@solid-imager/core/contract";',
			},
			{ filename: cli, code: 'import { client } from "./orpc-client";' },
		],
		invalid: [
			{
				filename: cli,
				code: 'import "../../../tools/workspace-imports.mjs";',
				errors: [/escapes the @solid-imager\/cli workspace/],
			},
			{
				filename: config,
				code: 'import preset from "../../packages/ui/tailwind.preset.js";',
				errors: [/through a public entry/],
			},
			{
				filename: cli,
				code: 'export type { AppRouter } from "../../server/src/infrastructure/api/app-router";',
				errors: [/through a public entry/],
			},
			{
				filename: cli,
				code: 'type T = typeof import("@solid-imager/server/app-router");',
				errors: [/not a public entry/],
			},
			{
				filename: cli,
				code: 'const db = import("@solid-imager/db");',
				errors: [/must declare its workspace dependency/],
			},
			{
				filename: cli,
				code: 'require.resolve("@solid-imager/core/domain/jobs/schemas");',
				errors: [/not a public entry/],
			},
		],
	},
);

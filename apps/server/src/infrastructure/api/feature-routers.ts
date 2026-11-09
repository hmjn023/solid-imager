import "zod/compile";

import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { authorsRouter } from "~/infrastructure/api/routers/authors-router";
import { categoriesRouter } from "~/infrastructure/api/routers/categories-router";
import { charactersRouter } from "~/infrastructure/api/routers/characters-router";
import { directoriesRouter } from "~/infrastructure/api/routers/directories-router";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { danbooruRouter } from "~/infrastructure/api/routers/danbooru-router";
import { importsRouter } from "~/infrastructure/api/routers/imports-router";
import { ipsRouter } from "~/infrastructure/api/routers/ips-router";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { mediaToolsRouter } from "~/infrastructure/api/routers/media-tools-router";
import { mediaRouter } from "~/infrastructure/api/routers/media-router";
import { presetsRouter } from "~/infrastructure/api/routers/presets-router";
import { projectsRouter } from "~/infrastructure/api/routers/projects-router";
import { searchSnapshotsRouter } from "~/infrastructure/api/routers/search-snapshots-router";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { thumbnailsRouter } from "~/infrastructure/api/routers/thumbnails-router";
import { utilsRouter } from "~/infrastructure/api/routers/utils-router";

/** Feature procedures shared by the API and the MCP tool catalog. */
export const featureRouters = {
	danbooru: danbooruRouter,
	sources: sourcesRouter,
	tags: tagsRouter,
	media: mediaRouter,
	tools: mediaToolsRouter,
	categories: categoriesRouter,
	projects: projectsRouter,
	characters: charactersRouter,
	ips: ipsRouter,
	authors: authorsRouter,
	thumbnails: thumbnailsRouter,
	downloads: downloadsRouter,
	directories: directoriesRouter,
	ai: aiRouter,
	imports: importsRouter,
	jobs: jobsRouter,
	utils: utilsRouter,
	presets: presetsRouter,
	searchSnapshots: searchSnapshotsRouter,
};

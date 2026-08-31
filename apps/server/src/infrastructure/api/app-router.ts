import "zod/compile";

import { implement } from "@orpc/server";
import { appContract } from "@solid-imager/core/domain/contract";
import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { authorsRouter } from "~/infrastructure/api/routers/authors-router";
import { categoriesRouter } from "~/infrastructure/api/routers/categories-router";
import { charactersRouter } from "~/infrastructure/api/routers/characters-router";
import { configRouter } from "~/infrastructure/api/routers/config-router";
import { directoriesRouter } from "~/infrastructure/api/routers/directories-router";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { importsRouter } from "~/infrastructure/api/routers/imports-router";
import { ipsRouter } from "~/infrastructure/api/routers/ips-router";
import { jobsRouter } from "~/infrastructure/api/routers/jobs-router";
import { mediaRouter } from "~/infrastructure/api/routers/media-router";
import { presetsRouter } from "~/infrastructure/api/routers/presets-router";
import { projectsRouter } from "~/infrastructure/api/routers/projects-router";
import { searchSnapshotsRouter } from "~/infrastructure/api/routers/search-snapshots-router";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { thumbnailsRouter } from "~/infrastructure/api/routers/thumbnails-router";
import { utilsRouter } from "~/infrastructure/api/routers/utils-router";

const appRouterImplementer = implement(appContract);

/**
 * Server implementation of the shared API contract.
 *
 * Keeping the contract on the implementer makes every server procedure
 * compile against the same contract consumed by Tauri, CLI, and xtracter.
 */
export const appRouter = appRouterImplementer.router({
	sources: sourcesRouter,
	tags: tagsRouter,
	media: mediaRouter,
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
	config: configRouter,
	presets: presetsRouter,
	searchSnapshots: searchSnapshotsRouter,
});

export type AppRouter = typeof appRouter;

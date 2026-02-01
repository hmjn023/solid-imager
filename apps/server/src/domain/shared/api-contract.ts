import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { authorsRouter } from "~/infrastructure/api/routers/authors-router";
import { categoriesRouter } from "~/infrastructure/api/routers/categories-router";
import { charactersRouter } from "~/infrastructure/api/routers/characters-router";
import { configRouter } from "~/infrastructure/api/routers/config-router";
import { directoriesRouter } from "~/infrastructure/api/routers/directories-router";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { importsRouter } from "~/infrastructure/api/routers/imports-router";
import { ipsRouter } from "~/infrastructure/api/routers/ips-router";
import { mediaRouter } from "~/infrastructure/api/routers/media-router";
import { presetsRouter } from "~/infrastructure/api/routers/presets-router";
import { projectsRouter } from "~/infrastructure/api/routers/projects-router";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { thumbnailsRouter } from "~/infrastructure/api/routers/thumbnails-router";
import { utilsRouter } from "~/infrastructure/api/routers/utils-router";

/**
 * API Router Definition
 * フロントエンドとバックエンドで共有される型定義
 */
export const appRouter = {
  sources: sourcesRouter,
  tags: tagsRouter,
  media: mediaRouter,
  categories: categoriesRouter,
  projects: projectsRouter,
  characters: charactersRouter,
  ips: ipsRouter,
  thumbnails: thumbnailsRouter,
  downloads: downloadsRouter,
  directories: directoriesRouter,
  ai: aiRouter,
  authors: authorsRouter,
  utils: utilsRouter,
  imports: importsRouter,
  config: configRouter,
  presets: presetsRouter,
};

export type AppRouter = typeof appRouter;

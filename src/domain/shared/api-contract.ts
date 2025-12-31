import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";

/**
 * API Router Definition
 * フロントエンドとバックエンドで共有される型定義
 */
export const appRouter = {
  sources: sourcesRouter,
  tags: tagsRouter,
};

export type AppRouter = typeof appRouter;

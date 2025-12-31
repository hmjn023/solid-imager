import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";

/**
 * API Router Definition
 * フロントエンドとバックエンドで共有される型定義
 */
export const appRouter = {
  sources: sourcesRouter,
};

export type AppRouter = typeof appRouter;

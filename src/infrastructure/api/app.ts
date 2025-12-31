import { RPCHandler } from "@orpc/server/fetch";
import { Elysia } from "elysia";
import { appRouter } from "~/domain/shared/api-contract";

const handler = new RPCHandler(appRouter);

/**
 * Elysia アプリケーション
 */
export const app = new Elysia().all(
  "/*",
  async ({ request }: { request: Request }) => {
    const { response } = await handler.handle(request, {
      prefix: "/api/rpc",
    });
    return response ?? new Response("Not Found", { status: 404 });
  },
  {
    parse: "none", // Disable Elysia body parser to prevent "body already used" error
  }
);

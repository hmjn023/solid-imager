import { os } from "@orpc/server";
import { z } from "zod";
import { DirectoryService } from "~/application/services/directory-service";

export const directoriesRouter = {
  list: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        path: z.string().default(""),
      })
    )
    .handler(
      async ({ input }) =>
        await DirectoryService.listMediaInSubdirectory(
          input.sourceId,
          input.path
        )
    ),

  create: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        path: z.string(),
        name: z.string(),
      })
    )
    .handler(
      async ({ input }) =>
        await DirectoryService.createDirectory(input.sourceId, {
          path: input.path,
          name: input.name,
        })
    ),

  delete: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        path: z.string(),
        force: z.boolean().optional(),
      })
    )
    .handler(
      async ({ input }) =>
        await DirectoryService.deleteDirectory(
          input.sourceId,
          input.path,
          input.force
        )
    ),

  rename: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        oldPath: z.string(),
        newPath: z.string(),
      })
    )
    .handler(
      async ({ input }) =>
        await DirectoryService.updateDirectory(input.sourceId, {
          oldPath: input.oldPath,
          newPath: input.newPath,
        })
    ),
};

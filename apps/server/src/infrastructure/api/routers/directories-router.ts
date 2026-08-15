import { implement } from "@orpc/server";
import { directoriesContract } from "@solid-imager/core/domain/contract/directories.contract";
import { DirectoryService } from "~/infrastructure/services/directory-service";

const os = implement(directoriesContract);

export const directoriesRouter = os.router({
	list: os.list.handler(
		async ({ input }) =>
			await DirectoryService.listMediaInSubdirectory(
				input.sourceId,
				input.path,
			),
	),

	create: os.create.handler(
		async ({ input }) =>
			await DirectoryService.createDirectory(input.sourceId, {
				path: input.path,
				name: input.name,
			}),
	),

	delete: os.delete.handler(
		async ({ input }) =>
			await DirectoryService.deleteDirectory(
				input.sourceId,
				input.path,
				input.force,
			),
	),

	rename: os.rename.handler(
		async ({ input }) =>
			await DirectoryService.updateDirectory(input.sourceId, {
				oldPath: input.oldPath,
				newPath: input.newPath,
			}),
	),
});

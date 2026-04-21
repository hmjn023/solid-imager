import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	type NewProject,
	type Project,
	projectSchema,
	type UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import { mediaProjects, projects } from "@solid-imager/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";

function toProject(row: typeof projects.$inferSelect): Project {
	return projectSchema.parse(row);
}

export const TauriProjectRepository = {
	async findAll(): Promise<Project[]> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(projects)
			.orderBy(asc(projects.name));
		return rows.map(toProject);
	},

	async findById(id: string): Promise<Project | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(projects)
			.where(eq(projects.id, id))
			.limit(1);
		return rows[0] ? toProject(rows[0]) : null;
	},

	async findByName(name: string): Promise<Project | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(projects)
			.where(eq(projects.name, name))
			.limit(1);
		return rows[0] ? toProject(rows[0]) : null;
	},

	async create(input: NewProject): Promise<Project> {
		const rows = await getTauriAppServices()
			.db.insert(projects)
			.values({
				name: input.name,
				description: input.description ?? "",
			})
			.returning();
		return toProject(rows[0]);
	},

	async update(id: string, input: UpdateProject): Promise<Project> {
		const rows = await getTauriAppServices()
			.db.update(projects)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined
					? { description: input.description ?? "" }
					: {}),
				...(input.archivedAt !== undefined
					? { archivedAt: input.archivedAt }
					: {}),
				updatedAt: new Date(),
			})
			.where(eq(projects.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Project", id);
		}

		return toProject(rows[0]);
	},

	async delete(id: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(projects)
			.where(eq(projects.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("Project", id);
		}
	},

	async findByMediaId(mediaId: string): Promise<Project[]> {
		const rows = await getTauriAppServices()
			.db.select({
				id: projects.id,
				name: projects.name,
				description: projects.description,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
				archivedAt: projects.archivedAt,
			})
			.from(projects)
			.innerJoin(mediaProjects, eq(projects.id, mediaProjects.projectId))
			.where(eq(mediaProjects.mediaId, mediaId))
			.orderBy(asc(projects.name));
		return rows.map(toProject);
	},

	async addMedia(mediaId: string, projectId: string): Promise<void> {
		await getTauriAppServices()
			.db.insert(mediaProjects)
			.values({ mediaId, projectId })
			.onConflictDoNothing();
	},

	async removeMedia(mediaId: string, projectId: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(mediaProjects)
			.where(
				and(
					eq(mediaProjects.mediaId, mediaId),
					eq(mediaProjects.projectId, projectId),
				),
			)
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("MediaProject association");
		}
	},

	async addMediaBulk(mediaId: string, projectIds: string[]): Promise<void> {
		for (const projectId of projectIds) {
			await this.addMedia(mediaId, projectId);
		}
	},
};

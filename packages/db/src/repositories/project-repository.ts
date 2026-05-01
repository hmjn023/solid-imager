import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import { projectSchema } from "@solid-imager/core/domain/projects/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import { and, asc, eq } from "drizzle-orm";
import { mediaProjects, projects } from "../schema";
import type { DrizzleExecutor } from "../types";

export type ProjectRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;

type CreateProjectRepositoryOptions = {
	orderByName?: boolean;
};

function mapToProject(row: typeof projects.$inferSelect): Project {
	return projectSchema.parse({
		id: row.id,
		name: row.name,
		description: row.description,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		archivedAt: row.archivedAt,
	});
}

export function createProjectRepository(
	getExecutor: ProjectRepositoryExecutorProvider,
	options: CreateProjectRepositoryOptions = {},
): IProjectRepository {
	return {
		async findAll(): Promise<Project[]> {
			const query = getExecutor().select().from(projects);
			const rows = options.orderByName ? await query.orderBy(asc(projects.name)) : await query;
			return rows.map(mapToProject);
		},

		async findById(id: string, tx?: unknown): Promise<Project | null> {
			const rows = await getExecutor(tx)
				.select()
				.from(projects)
				.where(eq(projects.id, id))
				.limit(1);
			return rows[0] ? mapToProject(rows[0]) : null;
		},

		async findByName(name: string, tx?: unknown): Promise<Project | null> {
			const rows = await getExecutor(tx)
				.select()
				.from(projects)
				.where(eq(projects.name, name))
				.limit(1);
			return rows[0] ? mapToProject(rows[0]) : null;
		},

		async create(input: NewProject, tx?: unknown): Promise<Project> {
			const rows = await getExecutor(tx)
				.insert(projects)
				.values({
					name: input.name,
					description: input.description ?? null,
				})
				.returning();
			return mapToProject(rows[0]);
		},

		async update(id: string, input: UpdateProject, tx?: unknown): Promise<Project> {
			const rows = await getExecutor(tx)
				.update(projects)
				.set({
					...(input.name !== undefined ? { name: input.name } : {}),
					...(input.description !== undefined ? { description: input.description ?? null } : {}),
					...(input.archivedAt !== undefined ? { archivedAt: input.archivedAt } : {}),
					updatedAt: new Date(),
				})
				.where(eq(projects.id, id))
				.returning();

			if (!rows[0]) {
				throw new ResourceNotFoundError("Project", id);
			}
			return mapToProject(rows[0]);
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			const rows = await getExecutor(tx).delete(projects).where(eq(projects.id, id)).returning();

			if (!rows[0]) {
				throw new ResourceNotFoundError("Project", id);
			}
		},

		async findByMediaId(mediaId: string, tx?: unknown): Promise<Project[]> {
			const query = getExecutor(tx)
				.select({
					id: projects.id,
					name: projects.name,
					description: projects.description,
					createdAt: projects.createdAt,
					updatedAt: projects.updatedAt,
					archivedAt: projects.archivedAt,
				})
				.from(projects)
				.innerJoin(mediaProjects, eq(projects.id, mediaProjects.projectId))
				.where(eq(mediaProjects.mediaId, mediaId));
			const rows = options.orderByName ? await query.orderBy(asc(projects.name)) : await query;
			return rows.map(mapToProject);
		},

		async addMedia(mediaId: string, projectId: string, tx?: unknown): Promise<void> {
			await getExecutor(tx)
				.insert(mediaProjects)
				.values({ mediaId, projectId })
				.onConflictDoNothing();
		},

		async removeMedia(mediaId: string, projectId: string, tx?: unknown): Promise<void> {
			const rows = await getExecutor(tx)
				.delete(mediaProjects)
				.where(and(eq(mediaProjects.mediaId, mediaId), eq(mediaProjects.projectId, projectId)))
				.returning();

			if (!rows[0]) {
				throw new ResourceNotFoundError("MediaProject association");
			}
		},

		async addMediaBulk(mediaId: string, projectIds: string[], tx?: unknown): Promise<void> {
			if (projectIds.length === 0) {
				return;
			}

			await getExecutor(tx)
				.insert(mediaProjects)
				.values(projectIds.map((projectId) => ({ mediaId, projectId })))
				.onConflictDoNothing();
		},
	};
}

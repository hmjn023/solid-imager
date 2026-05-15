import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import { getClient } from "@solid-imager/db";
import { mediaProjects, projects } from "@solid-imager/db/schema";
import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";

const mapToDomain = (dbProject: typeof projects.$inferSelect): Project => ({
	id: dbProject.id,
	name: dbProject.name,
	description: dbProject.description,
	createdAt: dbProject.createdAt || new Date(),
	updatedAt: dbProject.updatedAt || new Date(),
	archivedAt: dbProject.archivedAt,
});

export const ProjectRepository: IProjectRepository = {
	async findAll(): Promise<Project[]> {
		const dbProjects = await db.select().from(projects);
		return dbProjects.map(mapToDomain);
	},

	async findById(id: string, tx?: Transaction): Promise<Project | null> {
		const client = getClient(db, tx);
		const result = await client
			.select()
			.from(projects)
			.where(eq(projects.id, id));
		return result[0] ? mapToDomain(result[0]) : null;
	},

	async findByName(name: string, tx?: Transaction): Promise<Project | null> {
		const client = getClient(db, tx);
		const result = await client
			.select()
			.from(projects)
			.where(eq(projects.name, name));
		return result[0] ? mapToDomain(result[0]) : null;
	},

	async create(project: NewProject, tx?: Transaction): Promise<Project> {
		const client = getClient(db, tx);
		const result = await client.insert(projects).values(project).returning();
		return mapToDomain(result[0]);
	},

	async update(
		id: string,
		project: UpdateProject,
		tx?: Transaction,
	): Promise<Project> {
		const client = getClient(db, tx);
		const { archivedAt, ...rest } = project;
		const updateData: Partial<typeof projects.$inferInsert> = {
			...rest,
			updatedAt: new Date(),
		};
		if (archivedAt && typeof archivedAt === "string") {
			updateData.archivedAt = new Date(archivedAt);
		} else if (archivedAt === null) {
			updateData.archivedAt = null;
		}

		const result = await client
			.update(projects)
			.set(updateData)
			.where(eq(projects.id, id))
			.returning();

		if (!result[0]) {
			throw new ResourceNotFoundError("Project", id);
		}
		return mapToDomain(result[0]);
	},

	async delete(id: string, tx?: Transaction): Promise<void> {
		const client = getClient(db, tx);
		const result = await client
			.delete(projects)
			.where(eq(projects.id, id))
			.returning();

		if (result.length === 0) {
			throw new ResourceNotFoundError("Project", id);
		}
	},

	async findByMediaId(mediaId: string, tx?: Transaction): Promise<Project[]> {
		const client = getClient(db, tx);
		const result = await client
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

		return result.map((p: any) => ({
			...p,
			createdAt: p.createdAt || new Date(),
			updatedAt: p.updatedAt || new Date(),
		}));
	},

	async addMedia(
		mediaId: string,
		projectId: string,
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);
		await client
			.insert(mediaProjects)
			.values({ mediaId, projectId })
			.returning();
	},

	async removeMedia(
		mediaId: string,
		projectId: string,
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);
		const result = await client
			.delete(mediaProjects)
			.where(
				and(
					eq(mediaProjects.mediaId, mediaId),
					eq(mediaProjects.projectId, projectId),
				),
			)
			.returning();

		if (result.length === 0) {
			throw new ResourceNotFoundError("MediaProject association");
		}
	},
	async addMediaBulk(
		mediaId: string,
		projectIds: string[],
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);
		if (projectIds.length === 0) {
			return;
		}

		await client
			.insert(mediaProjects)
			.values(
				projectIds.map((projectId) => ({
					mediaId,
					projectId,
				})),
			)
			.onConflictDoNothing();
	},
};

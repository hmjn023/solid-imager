import { and, eq } from "drizzle-orm";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import type {
  NewProject,
  Project,
  UpdateProject,
} from "~/domain/projects/schemas";
import type { IProjectRepository } from "~/domain/repositories/project-repository";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import { mediaProjects, projects } from "~/infrastructure/db/schema";

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
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    const result = await client
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return result[0] ? mapToDomain(result[0]) : null;
  },

  async create(project: NewProject, tx?: Transaction): Promise<Project> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    const result = await client.insert(projects).values(project).returning();
    return mapToDomain(result[0]);
  },

  async update(
    id: string,
    project: UpdateProject,
    tx?: Transaction
  ): Promise<Project> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
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
      throw new NotFoundError({ message: `Project with id ${id} not found` });
    }
    return mapToDomain(result[0]);
  },

  async delete(id: string, tx?: Transaction): Promise<void> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    const result = await client
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError({ message: `Project with id ${id} not found` });
    }
  },

  async findByMediaId(mediaId: string, tx?: Transaction): Promise<Project[]> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
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

    return result.map(
      /* biome-ignore lint/suspicious/noExplicitAny: DB result mapping */ (
        p: any
      ) => ({
        ...p,
        createdAt: p.createdAt || new Date(),
        updatedAt: p.updatedAt || new Date(),
      })
    );
  },

  async addMedia(
    mediaId: string,
    projectId: string,
    tx?: Transaction
  ): Promise<void> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    await client
      .insert(mediaProjects)
      .values({ mediaId, projectId })
      .returning();
  },

  async removeMedia(
    mediaId: string,
    projectId: string,
    tx?: Transaction
  ): Promise<void> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    const result = await client
      .delete(mediaProjects)
      .where(
        and(
          eq(mediaProjects.mediaId, mediaId),
          eq(mediaProjects.projectId, projectId)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundError({
        message: `MediaProject with mediaId ${mediaId} and projectId ${projectId} not found`,
      });
    }
  },
};

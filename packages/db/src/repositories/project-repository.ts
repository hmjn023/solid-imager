import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
  NewProject,
  Project,
  UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import { and, eq, inArray } from "drizzle-orm";
import { mediaProjects, projects } from "../schema";
import type { DrizzleExecutor } from "../types";

function mapProject(
  row: typeof projects.$inferSelect,
): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt || new Date(),
    updatedAt: row.updatedAt || new Date(),
    archivedAt: row.archivedAt,
  };
}

export function createProjectRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): IProjectRepository {
  return {
    async findAll(): Promise<Project[]> {
      const rows = await getExecutor().select().from(projects);
      return rows.map(mapProject);
    },

    async findById(
      id: string,
      tx?: unknown,
    ): Promise<Project | null> {
      const rows = await getExecutor(tx)
        .select()
        .from(projects)
        .where(eq(projects.id, id));
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async findByName(
      name: string,
      tx?: unknown,
    ): Promise<Project | null> {
      const rows = await getExecutor(tx)
        .select()
        .from(projects)
        .where(eq(projects.name, name));
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async findByNames(
      names: string[],
      tx?: unknown,
    ): Promise<Project[]> {
      if (names.length === 0) {
        return [];
      }
      const rows = await getExecutor(tx)
        .select()
        .from(projects)
        .where(inArray(projects.name, names));
      return rows.map(mapProject);
    },

    async create(
      project: NewProject,
      tx?: unknown,
    ): Promise<Project> {
      const result = await getExecutor(tx)
        .insert(projects)
        .values(project)
        .returning();
      return mapProject(result[0]);
    },

    async update(
      id: string,
      project: UpdateProject,
      tx?: unknown,
    ): Promise<Project> {
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

      const result = await getExecutor(tx)
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!result[0]) {
        throw new ResourceNotFoundError("Project", id);
      }
      return mapProject(result[0]);
    },

    async delete(id: string, tx?: unknown): Promise<void> {
      const result = await getExecutor(tx)
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Project", id);
      }
    },

    async findByMediaId(
      mediaId: string,
      tx?: unknown,
    ): Promise<Project[]> {
      const rows = await getExecutor(tx)
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

      return rows as Project[];
    },

    async addMedia(
      mediaId: string,
      projectId: string,
      tx?: unknown,
    ): Promise<void> {
      await getExecutor(tx)
        .insert(mediaProjects)
        .values({ mediaId, projectId })
        .onConflictDoNothing();
    },

    async removeMedia(
      mediaId: string,
      projectId: string,
      tx?: unknown,
    ): Promise<void> {
      const result = await getExecutor(tx)
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
      tx?: unknown,
    ): Promise<void> {
      if (projectIds.length === 0) {
        return;
      }
      await getExecutor(tx)
        .insert(mediaProjects)
        .values(
          projectIds.map((projectId) => ({
            mediaId,
            projectId,
          })),
        )
        .onConflictDoNothing();
    },

    async findOrCreateBulk(
      names: string[],
      tx?: unknown,
    ): Promise<Project[]> {
      if (names.length === 0) {
        return [];
      }
      const uniqueNames = [...new Set(names)].filter((n) => n.length > 0);
      const client = getExecutor(tx);

      await client
        .insert(projects)
        .values(uniqueNames.map((name) => ({ name, description: "" })))
        .onConflictDoNothing({ target: [projects.name] });

      const result = await client
        .select()
        .from(projects)
        .where(inArray(projects.name, uniqueNames));

      return result.map(mapProject);
    },
  };
}

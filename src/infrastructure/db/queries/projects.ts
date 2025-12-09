import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { mediaProjects, projects } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

export async function selectProjects() {
  try {
    return await db.select().from(projects);
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to select projects" });
  }
}

export async function insertProject(project: typeof projects.$inferInsert) {
  try {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to insert project" });
  }
}

export async function selectProjectById(id: number) {
  try {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    if (result.length === 0) {
      return null;
    }
    return result[0];
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to select project by id" });
  }
}

export async function updateProject(
  id: number,
  project: Partial<typeof projects.$inferInsert>
) {
  try {
    const result = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Project with id ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: "Failed to update project" });
  }
}

export async function deleteProject(id: number) {
  try {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `Project with id ${id} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: "Failed to delete project" });
  }
}

export async function selectProjectsByMediaId(mediaId: string) {
  try {
    const result = await db
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
    return result;
  } catch (_error) {
    throw new UnknownDbError({
      message: "Failed to select projects by media id",
    });
  }
}

export async function insertMediaProject(mediaId: string, projectId: number) {
  try {
    const result = await db
      .insert(mediaProjects)
      .values({ mediaId, projectId })
      .returning();
    return result[0];
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to insert media project" });
  }
}

export async function deleteMediaProject(mediaId: string, projectId: number) {
  try {
    const result = await db
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
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: "Failed to delete media project" });
  }
}

import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { projects } from "~/infrastructure/db/schema";

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class UnknownDbError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnknownDbError";
    }
}

export async function selectProjects() {
    try {
        return await db.select().from(projects);
    } catch (error) {
        console.error("Error selecting projects:", error);
        throw new UnknownDbError("Failed to select projects");
    }
}

export async function insertProject(project: typeof projects.$inferInsert) {
    try {
        const result = await db.insert(projects).values(project).returning();
        return result[0];
    } catch (error) {
        console.error("Error inserting project:", error);
        throw new UnknownDbError("Failed to insert project");
    }
}

export async function selectProjectById(id: number) {
    try {
        const result = await db.select().from(projects).where(eq(projects.id, id));
        if (result.length === 0) {
            return null;
        }
        return result[0];
    } catch (error) {
        console.error("Error selecting project by id:", error);
        throw new UnknownDbError("Failed to select project by id");
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
            throw new NotFoundError(`Project with id ${id} not found`);
        }
        return result[0];
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        console.error("Error updating project:", error);
        throw new UnknownDbError("Failed to update project");
    }
}

export async function deleteProject(id: number) {
    try {
        const result = await db
            .delete(projects)
            .where(eq(projects.id, id))
            .returning();
        if (result.length === 0) {
            throw new NotFoundError(`Project with id ${id} not found`);
        }
        return result[0];
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        console.error("Error deleting project:", error);
        throw new UnknownDbError("Failed to delete project");
    }
}

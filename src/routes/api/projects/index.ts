import { ProjectService } from "~/application/services/project-service";
import { newProjectSchema } from "~/domain/projects/schemas";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
 */
export async function GET() {
    try {
        const projects = await ProjectService.getAllProjects();
        return new Response(JSON.stringify(projects), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (_error) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewProject'
 *     responses:
 *       201:
 *         description: Project created
 *       400:
 *         description: Invalid input
 */
export async function POST({ request }: { request: Request }) {
    try {
        const body = await request.json();
        const result = newProjectSchema.safeParse(body);

        if (!result.success) {
            return new Response(JSON.stringify({ error: result.error }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const project = await ProjectService.createProject(result.data);
        return new Response(JSON.stringify(project), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error creating project:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

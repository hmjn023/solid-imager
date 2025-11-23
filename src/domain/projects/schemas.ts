import { z } from "zod";

export const newProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").optional(),
  description: z.string().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export type NewProject = z.infer<typeof newProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

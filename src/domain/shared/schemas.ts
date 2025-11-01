import { z } from "zod";

export const appConfigSchema = z
  .object({
    server: z
      .object({
        port: z.number().optional(),
        host: z.string().optional(),
      })
      .optional(),
    media: z
      .object({
        supportedFormats: z.array(z.string()).optional(),
        thumbnailSizes: z.array(z.number()).optional(),
        cacheDirectory: z.string().optional(),
        autoGenerate: z.boolean().optional(),
        maxConcurrentJobs: z.number().optional(),
      })
      .optional(),
    upload: z
      .object({
        maxFileSize: z.number().optional(),
        allowOverwrite: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough(); // Allow for future expansion
export type AppConfig = z.infer<typeof appConfigSchema>;

export const searchOptionsSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    filename: z.string().optional(),
    dateRange: z
      .object({
        from: z.date().optional(),
        to: z.date().optional(),
      })
      .optional(),
  })
  .passthrough(); // Allow for future expansion
export type SearchOptions = z.infer<typeof searchOptionsSchema>;

export const importDataSchema = z.object({
  url: z.string().optional(),
  file: z.any().optional(), // File type is complex, using z.any() for now
  data: z.any().optional(), // Using z.any() for direct data payload
});
export type ImportData = z.infer<typeof importDataSchema>;

export const userDataSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().optional(),
});
export type UserData = z.infer<typeof userDataSchema>;

export const collectionDataSchema = z.object({
  userId: z.string().uuid(), // Assuming UUID for userId
  name: z.string(),
  description: z.string().optional(),
});
export type CollectionData = z.infer<typeof collectionDataSchema>;

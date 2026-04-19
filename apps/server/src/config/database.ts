import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Define Zod schemas for connection details
const PgliteConnectionDetailsSchema = z.object({
	path: z.string().optional(),
	inMemory: z.boolean().default(false),
});

const DockerComposePostgresConnectionDetailsSchema = z.object({
	host: z.string(),
	port: z.number().int().positive(),
	user: z.string(),
	password: z.string(),
	database: z.string(),
});

// Define Zod schema for the overall database configuration
const DatabaseConfigSchema = z.discriminatedUnion("databaseType", [
	z.object({
		databaseType: z.literal("pglite"),
		pglite: PgliteConnectionDetailsSchema,
	}),
	z.object({
		databaseType: z.literal("docker-compose-postgres"),
		dockerComposePostgres: DockerComposePostgresConnectionDetailsSchema,
	}),
]);

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type PgliteConnectionDetails = z.infer<
	typeof PgliteConnectionDetailsSchema
>;
export type DockerComposePostgresConnectionDetails = z.infer<
	typeof DockerComposePostgresConnectionDetailsSchema
>;

const CONFIG_FILE_NAME = "db.config.json";

export function loadDatabaseConfig(
	configPath: string = process.cwd(),
): DatabaseConfig {
	const fullPath = join(configPath, CONFIG_FILE_NAME);
	try {
		const configFileContent = readFileSync(fullPath, "utf-8");
		const config = JSON.parse(configFileContent);
		return DatabaseConfigSchema.parse(config);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error("Invalid database configuration file format.");
		}
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			throw new Error(
				`Database configuration file not found: ${CONFIG_FILE_NAME}.`,
			);
		}
		throw new Error("Failed to load database configuration.");
	}
}

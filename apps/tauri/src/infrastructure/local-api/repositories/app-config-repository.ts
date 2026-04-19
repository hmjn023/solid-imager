import {
	type AppConfig,
	AppConfigSchema,
	defaultAppConfig,
} from "@solid-imager/core/domain/config/config-schema";
import { eq } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { appConfig } from "@solid-imager/db/schema";

const APP_CONFIG_ID = 1;

async function ensureConfigRow() {
	const db = getTauriAppServices().db;
	const existing = await db
		.select()
		.from(appConfig)
		.where(eq(appConfig.id, APP_CONFIG_ID))
		.limit(1);

	if (existing[0]) {
		return existing[0];
	}

	const inserted = await db
		.insert(appConfig)
		.values({
			id: APP_CONFIG_ID,
			value: defaultAppConfig,
			updatedAt: new Date(),
		})
		.returning();

	return inserted[0];
}

export const AppConfigRepository = {
	async get(): Promise<AppConfig> {
		const row = await ensureConfigRow();
		return AppConfigSchema.parse(row.value);
	},

	async save(value: AppConfig): Promise<AppConfig> {
		const validated = AppConfigSchema.parse(value);
		const db = getTauriAppServices().db;
		const updatedAt = new Date();

		await db
			.insert(appConfig)
			.values({
				id: APP_CONFIG_ID,
				value: validated,
				updatedAt,
			})
			.onConflictDoUpdate({
				target: appConfig.id,
				set: {
					value: validated,
					updatedAt,
				},
			});

		return validated;
	},
};

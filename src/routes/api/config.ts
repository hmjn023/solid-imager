import type { APIEvent } from "@solidjs/start/server";
import type { AppConfig } from "~/domain/shared/schemas";

/**
 * Stub implementation for config API
 * This file is kept as a placeholder to avoid breaking build dependencies
 * until the configuration system is properly refactored.
 */

// biome-ignore lint/style/noMagicNumbers: Default thumbnail sizes
const DEFAULT_THUMBNAIL_SIZES = [256, 512];

const defaultConfig: AppConfig = {
  server: { port: 3000, host: "localhost" },
  media: {
    supportedFormats: ["jpg", "png", "webp"],
    thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
    autoGenerate: true,
  },
  upload: { maxFileSize: 10_485_760, allowOverwrite: false },
};

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Retrieve application settings
 *     description: Fetches the current application configuration.
 *     tags:
 *       - Configuration
 *     responses:
 *       200:
 *         description: Current application settings.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppConfig'
 *       500:
 *         description: Internal server error.
 */
export function GET() {
  return defaultConfig;
}

/**
 * @swagger
 * /api/config:
 *   put:
 *     summary: Update application settings
 *     description: Updates the application configuration with the provided data.
 *     tags:
 *       - Configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppConfig'
 *     responses:
 *       200:
 *         description: The updated application settings.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppConfig'
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ request }: APIEvent) {
  try {
    const newConfig = (await request.json()) as AppConfig;
    // Stub: just return the received config without saving
    return newConfig;
  } catch (error: unknown) {
    return {
      error: (error as Error).message,
      status: 400,
    };
  }
}

/**
 * @swagger
 * /api/config:
 *   post:
 *     summary: Reset application settings
 *     description: Resets the application configuration to default values.
 *     tags:
 *       - Configuration
 *     responses:
 *       200:
 *         description: Application settings successfully reset.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AppConfig'
 *       500:
 *         description: Internal server error.
 */
export function POST() {
  return defaultConfig;
}

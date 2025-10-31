import type { APIEvent } from "@solidjs/start/server";
import type { AppConfig } from "~/domain/shared/types";
import {
  getConfig,
  resetConfig,
  updateConfig,
} from "~/infrastructure/api-clients/config";

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
  try {
    const config = getConfig();
    return config;
  } catch (error: unknown) {
    return {
      error: error.message,
      status: 500,
    };
  }
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
    const result = updateConfig(newConfig);
    return result;
  } catch (error: unknown) {
    return {
      error: error.message,
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
  try {
    const result = resetConfig();
    return result;
  } catch (error: unknown) {
    return { error: error.message, status: 500 };
  }
}

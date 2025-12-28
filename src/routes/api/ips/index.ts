import type { APIEvent } from "@solidjs/start/server";
import { ZodError } from "zod";
import { IpService } from "~/application/services/ip-service";
import { newIpSchema } from "~/domain/ips/schemas";
import { logger } from "~/infrastructure/logger";

/**
 * @swagger
 * /api/ips:
 *   get:
 *     summary: Retrieve all IPs (Intellectual Properties)
 *     description: Fetches a list of all configured Intellectual Properties.
 *     tags:
 *       - IPs
 *     responses:
 *       200:
 *         description: A list of IPs.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IP'
 *       500:
 *         description: Internal server error.
 */
export async function GET() {
  try {
    const ips = await IpService.getAllIps();
    return new Response(JSON.stringify(ips), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch IPs");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * @swagger
 * /api/ips:
 *   post:
 *     summary: Create a new IP (Intellectual Property)
 *     description: Creates a new Intellectual Property with the provided data.
 *     tags:
 *       - IPs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewIP'
 *     responses:
 *       201:
 *         description: The created IP.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IP'
 *       400:
 *         description: Invalid input.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ request }: APIEvent) {
  try {
    const data = await request.json();
    const validatedData = newIpSchema.parse(data);
    const newIp = await IpService.createIp(validatedData);
    return new Response(JSON.stringify(newIp), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ err: error }, "Invalid IP creation request");
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error({ err: error }, "Failed to create IP");
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

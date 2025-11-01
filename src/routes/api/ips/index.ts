import type { APIEvent } from "@solidjs/start/server";
import { createIp, getIps } from "~/infrastructure/api-clients/ips";

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
  const ips = await getIps();
  return ips;
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
  const { name, description } = await request.json();
  const newIp = await createIp(name, description);
  return newIp;
}

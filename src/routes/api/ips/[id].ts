import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import {
  deleteIp,
  getIpById,
  updateIp,
} from "~/infrastructure/api-clients/ips";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

// PUTリクエストボディのスキーマ
const UpdateIpBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});
export type UpdateIpBody = z.infer<typeof UpdateIpBodySchema>;

/**
 * @swagger
 * /api/ips/{id}:
 *   get:
 *     summary: Retrieve a specific IP (Intellectual Property)
 *     description: Fetches details of an Intellectual Property by its ID.
 *     tags:
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the IP to retrieve.
 *     responses:
 *       200:
 *         description: Details of the IP.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IP'
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: IP not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;
  const ip = await getIpById(id);
  return ip;
}

/**
 * @swagger
 * /api/ips/{id}:
 *   put:
 *     summary: Update a specific IP (Intellectual Property)
 *     description: Updates an existing Intellectual Property with the provided data.
 *     tags:
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the IP to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateIP'
 *     responses:
 *       200:
 *         description: The updated IP.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IP'
 *       400:
 *         description: Invalid ID or invalid input.
 *       404:
 *         description: IP not found.
 *       500:
 *         description: Internal server error.
 */
export async function PUT({ params, request }: APIEvent) {
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;

  const body = await request.json();
  const parsedBody = UpdateIpBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ errors: parsedBody.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { name, description } = parsedBody.data;

  const updatedIp = await updateIp(id, { name, description });
  return updatedIp;
}

/**
 * @swagger
 * /api/ips/{id}:
 *   delete:
 *     summary: Delete a specific IP (Intellectual Property)
 *     description: Deletes an Intellectual Property by its ID.
 *     tags:
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the IP to delete.
 *     responses:
 *       200:
 *         description: IP successfully deleted.
 *       400:
 *         description: Invalid ID supplied.
 *       404:
 *         description: IP not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params }: APIEvent) {
  const parsedParams = IdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ errors: parsedParams.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = parsedParams.data;
  const result = await deleteIp(id);
  return result;
}

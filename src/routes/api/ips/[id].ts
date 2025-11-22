import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { IpService } from "~/application/services/ip-service";
import { updateIpSchema } from "~/domain/ips/schemas";

// パスパラメータ 'id' のスキーマ
const IdParamSchema = z.object({
  id: z.string().transform(Number), // URLからの文字列IDを数値に変換します。
});
export type IdParam = z.infer<typeof IdParamSchema>;

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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const ip = await IpService.getIpDetails(id);
    return new Response(JSON.stringify(ip), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;

    const body = await request.json();
    const validatedBody = updateIpSchema.parse(body);

    const updatedIp = await IpService.updateIp(id, validatedBody);
    return new Response(JSON.stringify(updatedIp), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
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
  try {
    const parsedParams = IdParamSchema.parse(params);
    const { id } = parsedParams;
    const result = await IpService.deleteIp(id);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(JSON.stringify({ errors: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

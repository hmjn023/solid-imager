import type { APIEvent } from "@solidjs/start/server";
import { ZodError, z } from "zod";
import { IpService } from "~/application/services/ip-service";
import { NotFoundError } from "~/infrastructure/db/errors";

const MediaParamsSchema = z.object({
  mediaSourceId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

const IpBodySchema = z.object({
  ipId: z.number(),
});

/**
 * @swagger
 * /api/sources/{mediaSourceId}/{mediaId}/ips:
 *   get:
 *     summary: Retrieve IPs associated with a media
 *     description: Fetches a list of Intellectual Properties linked to a specific media file.
 *     tags:
 *       - Media
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     responses:
 *       200:
 *         description: A list of IPs associated with the media.
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media not found.
 *       500:
 *         description: Internal server error.
 */
export async function GET({ params }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const ips = await IpService.getIpsForMedia(mediaId);
    return new Response(JSON.stringify(ips), {
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
 * /api/sources/{mediaSourceId}/{mediaId}/ips:
 *   post:
 *     summary: Add an IP to a media
 *     description: Associates an IP with a specific media file.
 *     tags:
 *       - Media
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ipId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: IP added to media.
 *       400:
 *         description: Invalid data supplied.
 *       500:
 *         description: Internal server error.
 */
export async function POST({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { ipId } = IpBodySchema.parse(body);

    const result = await IpService.addIpToMedia(mediaId, ipId);
    return new Response(JSON.stringify(result), {
      status: 201,
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
 * /api/sources/{mediaSourceId}/{mediaId}/ips:
 *   delete:
 *     summary: Remove an IP from a media
 *     description: Removes the association between an IP and a specific media file.
 *     tags:
 *       - Media
 *       - IPs
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media source.
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the media file.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ipId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: IP removed from media.
 *       400:
 *         description: Invalid data supplied.
 *       404:
 *         description: Association not found.
 *       500:
 *         description: Internal server error.
 */
export async function DELETE({ params, request }: APIEvent) {
  try {
    const { mediaId } = MediaParamsSchema.parse(params);
    const body = await request.json();
    const { ipId } = IpBodySchema.parse(body);

    const result = await IpService.removeIpFromMedia(mediaId, ipId);
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
    if (error instanceof NotFoundError) {
      return new Response(JSON.stringify({ error: "Association not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

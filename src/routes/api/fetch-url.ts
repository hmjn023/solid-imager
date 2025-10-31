import type { APIEvent } from "@solidjs/start/server";

/**
 * @swagger
 * /api/fetch-url:
 *   post:
 *     summary: Fetch content from a URL
 *     description: Fetches content from a specified URL. Useful for proxying requests or retrieving external resources.
 *     tags:
 *       - Utilities
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: The URL to fetch content from.
 *     responses:
 *       200:
 *         description: Content fetched successfully.
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           default:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: URL is required or invalid.
 *       500:
 *         description: Failed to fetch URL or internal server error.
 */
export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json();
    const url = body.url;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(url);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch URL" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = response.headers.get("content-type");
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

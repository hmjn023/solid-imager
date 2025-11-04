/**
 * @swagger
 * /api/sources/{sourceId}/{mediaId}/charactors:
 *   get:
 *     summary: Retrieve characters associated with a media
 *     description: Fetches a list of characters linked to a specific media file.
 *     tags:
 *       - Media
 *       - Characters
 *     parameters:
 *       - in: path
 *         name: sourceId
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
 *         description: A list of characters associated with the media.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Character'
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media or characters not found.
 *       500:
 *         description: Internal server error.
 */
export function GET() {
  return {
    endpoint: "/api/charactors",
    params: {},
  };
}

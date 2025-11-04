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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IP'
 *       400:
 *         description: Invalid source ID or media ID supplied.
 *       404:
 *         description: Media or IPs not found.
 *       500:
 *         description: Internal server error.
 */
export function GET() {
  return {
    endpoint: "/api/ips",
    params: {},
  };
}

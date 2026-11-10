import { pixivImageUrlSchema } from "@solid-imager/core/external-viewer";
export async function servePixivImage(
	request: Request,
	fetchImage: typeof fetch = fetch,
) {
	const parsed = pixivImageUrlSchema.safeParse(
		new URL(request.url).searchParams.get("url"),
	);
	if (!parsed.success) return new Response(null, { status: 400 });
	try {
		const response = await fetchImage(parsed.data, {
			redirect: "error",
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
			headers: { Referer: "https://www.pixiv.net/" },
		});
		const type = response.headers
			.get("content-type")
			?.split(";")[0]
			?.toLowerCase();
		if (
			!response.ok ||
			!type ||
			!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)
		) {
			await response.body?.cancel();
			return new Response(null, {
				status: response.status === 404 ? 404 : 502,
			});
		}
		return new Response(response.body, {
			headers: {
				"Content-Type": type,
				"Cache-Control": "private, max-age=1800",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch {
		return new Response(null, { status: 502 });
	}
}

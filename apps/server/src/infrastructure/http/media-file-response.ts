type ByteRange = { start: number; end: number };

function resolveRange(
	value: string,
	size: number,
): ByteRange | null | undefined {
	// Ignore unsupported units and multipart ranges rather than buffering a multipart response.
	const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
	if (!match || (!match[1] && !match[2])) return undefined;
	if (size === 0) return null;
	if (!match[1]) {
		const suffixLength = Number(match[2]);
		if (suffixLength === 0) return null;
		return { start: Math.max(0, size - suffixLength), end: size - 1 };
	}
	const start = Number(match[1]);
	const requestedEnd = match[2] ? Number(match[2]) : size - 1;
	if (start >= size || requestedEnd < start) return null;
	return { start, end: Math.min(requestedEnd, size - 1) };
}

/** Preserves byte-range streaming when a Bun file passes through Node/Nitro adapters. */
export function createMediaFileResponse(
	request: Request,
	file: Blob,
	contentType: string,
): Response {
	const headers = new Headers({
		"Accept-Ranges": "bytes",
		"Cache-Control": "no-store",
		"Content-Type": contentType,
		"Content-Length": String(file.size),
	});
	// If-Range cannot be validated without a stable representation validator, so send the whole file.
	const rangeHeader = request.headers.get("Range");
	const range =
		request.method === "GET" && rangeHeader && !request.headers.has("If-Range")
			? resolveRange(rangeHeader, file.size)
			: undefined;
	if (range === null) {
		headers.set("Content-Range", `bytes */${file.size}`);
		headers.set("Content-Length", "0");
		return new Response(null, { status: 416, headers });
	}
	if (range) {
		headers.set(
			"Content-Range",
			`bytes ${range.start}-${range.end}/${file.size}`,
		);
		headers.set("Content-Length", String(range.end - range.start + 1));
		return new Response(file.slice(range.start, range.end + 1), {
			status: 206,
			headers,
		});
	}
	return new Response(request.method === "HEAD" ? null : file, { headers });
}

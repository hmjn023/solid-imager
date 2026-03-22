import type { APIEvent } from "@solidjs/start/server";
import { app } from "~/infrastructure/api/app";

/**
 * Catch-all API route
 * すべての /api/* リクエストを Elysia に委譲
 */
export async function GET(event: APIEvent) {
	const res = await app.handle(event.request);
	return res;
}

export async function POST(event: APIEvent) {
	const res = await app.handle(event.request);
	return res;
}

export async function PUT(event: APIEvent) {
	return await app.handle(event.request);
}

export async function DELETE(event: APIEvent) {
	return await app.handle(event.request);
}

export async function PATCH(event: APIEvent) {
	return await app.handle(event.request);
}

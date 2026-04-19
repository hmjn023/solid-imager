/**
 * Base API Client
 * Provides common utilities for frontend API calls with SSR support and Zod validation
 */

import { isServer } from "solid-js/web";
import type { ZodSchema } from "zod";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
	status?: number;
	data?: unknown;

	constructor(message: string, status?: number, data?: unknown) {
		super(message);
		this.status = status;
		this.data = data;
		this.name = "ApiError";
	}
}

/**
 * Builds the full URL for API requests, handling SSR scenarios
 * @param path - The API path (e.g., "/api/sources")
 * @returns The full URL for the request
 */
export function buildUrl(path: string): string {
	// In SSR context, we need to use full URL with localhost
	if (isServer) {
		const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
		return `${baseUrl}${path}`;
	}
	// In browser context, use relative path
	return path;
}

/**
 * Makes an API request with Zod schema validation
 * @param path - The API path
 * @param schema - The Zod schema to validate the response
 * @param options - Fetch options
 * @returns The validated response data
 */
export async function apiRequest<T>(
	path: string,
	schema: ZodSchema<T>,
	options?: RequestInit,
): Promise<T> {
	const url = buildUrl(path);

	try {
		const response = await fetch(url, {
			cache: "no-store",
			...options,
		});

		if (!response.ok) {
			// Try to parse error response
			let errorData: unknown;
			try {
				const text = await response.text();
				try {
					errorData = JSON.parse(text);
				} catch {
					errorData = text;
				}
			} catch {
				errorData = "Unknown error";
			}

			throw new ApiError(`API request failed: ${response.statusText}`, response.status, errorData);
		}

		const HttpStatusNoContent = 204;
		if (response.status === HttpStatusNoContent) {
			return undefined as T;
		}

		const data = await response.json();
		return schema.parse(data);
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw new ApiError(`Network error: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Makes an API request that returns a Blob (e.g., for file downloads)
 * @param path - The API path
 * @param options - Fetch options
 * @returns The response as a Blob
 */
export async function apiBlobRequest(path: string, options?: RequestInit): Promise<Blob> {
	const url = buildUrl(path);

	try {
		const response = await fetch(url, {
			cache: "no-store",
			...options,
		});

		if (!response.ok) {
			throw new ApiError(`API request failed: ${response.statusText}`, response.status);
		}

		return await response.blob();
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw new ApiError(`Network error: ${error instanceof Error ? error.message : String(error)}`);
	}
}

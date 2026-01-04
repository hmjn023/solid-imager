import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "~/domain/shared/api-contract";

const DEFAULT_API_URL = "http://localhost:3000/api/rpc";
const REQUEST_TIMEOUT_MS = 10000; // 10秒

export class APIError extends Error {
    constructor(
        message: string,
        public readonly code: 'NETWORK_ERROR' | 'TIMEOUT' | 'CORS_ERROR' | 'SERVER_ERROR' | 'UNKNOWN',
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export const getClient = async () => {
    const result = await chrome.storage.local.get(['apiUrl']);
    const url = result.apiUrl || DEFAULT_API_URL;

    const link = new RPCLink({
        url: url,
        fetch: async (input, init) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            try {
                const response = await fetch(input, {
                    ...init,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);

                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        throw new APIError(
                            `Request timeout after ${REQUEST_TIMEOUT_MS}ms`,
                            'TIMEOUT',
                            error
                        );
                    }
                    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
                        throw new APIError(
                            'CORS error - server may not allow requests from this origin',
                            'CORS_ERROR',
                            error
                        );
                    }
                    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        throw new APIError(
                            `Network error - cannot connect to ${url}`,
                            'NETWORK_ERROR',
                            error
                        );
                    }
                }

                throw new APIError(
                    'Unknown error during API request',
                    'UNKNOWN',
                    error
                );
            }
        },
    });

    return createORPCClient(link) as RouterClient<AppRouter>;
};

/**
 * APIサーバーへの接続をテストする
 */
export const testConnection = async (apiUrl?: string): Promise<{ success: boolean; error?: string }> => {
    try {
        if (apiUrl) {
            await chrome.storage.local.set({ apiUrl });
        }

        const client = await getClient();
        await client.sources.list();

        return { success: true };
    } catch (error) {
        console.error('[xtracter] Connection test failed:', error);

        if (error instanceof APIError) {
            return { success: false, error: error.message };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

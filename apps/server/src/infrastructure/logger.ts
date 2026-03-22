import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	transport: isDev
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
				},
			}
		: undefined,
});

/**
 * Updates the log level dynamically.
 * @param level - The new log level (trace, debug, info, warn, error, fatal)
 */
export function updateLogLevel(level: string): void {
	logger.level = level;
}

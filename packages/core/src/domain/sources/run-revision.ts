import { createHash } from "node:crypto";
import {
	localConnectionSchema,
	sftpConnectionSchema,
	s3ConnectionSchema,
} from "./schemas";
/** Server-only identity; private connection values never leave the run model. */
export function getSourceRunRevision(
	type: string,
	connectionInfo: unknown,
): string {
	if (!["local", "sftp", "s3"].includes(type))
		throw new Error("Unsupported source type");
	const connection =
		type === "local"
			? localConnectionSchema.parse(connectionInfo)
			: type === "sftp"
				? sftpConnectionSchema.parse(connectionInfo)
				: s3ConnectionSchema.parse(connectionInfo);
	return createHash("sha256")
		.update(JSON.stringify([type, connection]))
		.digest("hex");
}

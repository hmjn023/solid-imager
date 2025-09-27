import { z } from "zod";

/**
 * Represents the schema for a local media source connection.
 * @property {string} path - The absolute path to the media directory on the local filesystem.
 */
export const localConnectionSchema = z.object({
  path: z.string().min(1, "パスは必須です"),
});

const DEFAULT_SFTP_PORT = 22;

/**
 * Represents the schema for an SFTP media source connection.
 * @property {string} host - The hostname or IP address of the SFTP server.
 * @property {number} port - The port number for the SFTP connection.
 * @property {string} username - The username for authentication.
 * @property {string} [password] - The password for authentication (optional).
 * @property {string} [privateKey] - The private key for key-based authentication (optional).
 * @property {string} remotePath - The absolute path to the media directory on the remote server.
 */
export const sftpConnectionSchema = z.object({
  host: z.string().min(1, "ホスト名は必須です"),
  port: z.number().int().positive().default(DEFAULT_SFTP_PORT),
  username: z.string().min(1, "ユーザー名は必須です"),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  remotePath: z.string().min(1, "リモートパスは必須です"),
});

/**
 * Represents the schema for an S3 media source connection.
 * @property {string} region - The AWS region where the bucket is located.
 * @property {string} bucket - The name of the S3 bucket.
 * @property {string} accessKeyId - The AWS access key ID for authentication.
 * @property {string} secretAccessKey - The AWS secret access key for authentication.
 * @property {string} [prefix] - The prefix (subfolder) within the bucket where media is stored (optional).
 */
export const s3ConnectionSchema = z.object({
  region: z.string().min(1, "リージョンは必須です"),
  bucket: z.string().min(1, "バケット名は必須です"),
  accessKeyId: z.string().min(1, "アクセスキーIDは必須です"),
  secretAccessKey: z.string().min(1, "シークレットアクセスキーは必須です"),
  prefix: z.string().optional(),
});

export const mediaSourceSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  description: z.string().optional(),
  type: z.enum(["local", "sftp", "s3"]),
  // TODO: Make this dynamic based on the type
  connectionInfo: localConnectionSchema,
});

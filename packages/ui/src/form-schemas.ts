import { z } from "zod";

export const createSourceFormSchema = (requireSecrets: boolean) =>
	z
		.object({
			name: z.string().trim().min(1, "Name is required"),
			description: z.string(),
			type: z.enum(["local", "sftp", "s3"]),
			path: z.string(),
			host: z.string(),
			port: z.number().or(z.nan()),
			username: z.string(),
			password: z.string(),
			remotePath: z.string(),
			bucket: z.string(),
			region: z.string(),
			accessKeyId: z.string(),
			secretAccessKey: z.string(),
			prefix: z.string(),
		})
		.superRefine((value, context) => {
			const requireField = (
				field:
					| "path"
					| "host"
					| "username"
					| "remotePath"
					| "bucket"
					| "region"
					| "accessKeyId"
					| "secretAccessKey",
				message: string,
			) => {
				if (!value[field].trim()) {
					context.addIssue({ code: "custom", message, path: [field] });
				}
			};

			if (value.type === "local") {
				requireField("path", "Path is required");
			} else if (value.type === "sftp") {
				if (!Number.isInteger(value.port) || value.port <= 0) {
					context.addIssue({
						code: "custom",
						message: "Port must be positive",
						path: ["port"],
					});
				}
				requireField("host", "Host is required");
				requireField("username", "Username is required");
				requireField("remotePath", "Remote path is required");
			} else {
				requireField("bucket", "Bucket is required");
				requireField("region", "Region is required");
				if (requireSecrets) {
					requireField("accessKeyId", "Access Key ID is required");
					requireField("secretAccessKey", "Secret Access Key is required");
				}
			}
		});

export type SourceFormValues = z.infer<
	ReturnType<typeof createSourceFormSchema>
>;

export const uploadFormSchema = z.object({
	filename: z.string().trim().min(1, "ファイル名を入力してください。"),
	description: z.string(),
	sourceUrl: z.string().url("有効なURLを入力してください。").or(z.literal("")),
	conflictResolution: z.enum(["overwrite", "skip", "rename"]),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;

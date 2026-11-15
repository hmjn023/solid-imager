import { t } from "@solid-imager/i18n";
import { z } from "zod";

export const createSourceFormSchema = (requireSecrets: boolean) =>
	z
		.object({
			name: z.string().trim().min(1, t("form.nameRequired")),
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
				requireField("path", t("form.pathRequired"));
			} else if (value.type === "sftp") {
				if (!Number.isInteger(value.port) || value.port <= 0) {
					context.addIssue({
						code: "custom",
						message: t("formSchemas.portMustBePositive"),
						path: ["port"],
					});
				}
				requireField("host", t("form.hostRequired"));
				requireField("username", t("form.usernameRequired"));
				requireField("remotePath", t("form.remotePathRequired"));
			} else {
				requireField("bucket", t("form.bucketRequired"));
				requireField("region", t("form.regionRequired"));
				if (requireSecrets) {
					requireField("accessKeyId", t("form.accessKeyRequired"));
					requireField("secretAccessKey", t("form.secretKeyRequired"));
				}
			}
		});

export type SourceFormValues = z.infer<
	ReturnType<typeof createSourceFormSchema>
>;

export const uploadFormSchema = z.object({
	filename: z.string().trim(),
	description: z.string(),
	sourceUrl: z.url(t("formSchemas.enterAValidURL")).or(z.literal("")),
	conflictResolution: z.enum(["overwrite", "skip", "rename"]),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;

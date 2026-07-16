import { describe, expect, test } from "vitest";
import {
	createSourceFormSchema,
	type SourceFormValues,
	uploadFormSchema,
} from "./form-schemas";

const validSourceValues: SourceFormValues = {
	name: "Pictures",
	description: "",
	type: "local",
	path: "/media/pictures",
	host: "",
	port: 22,
	username: "",
	password: "",
	remotePath: "",
	bucket: "",
	region: "",
	accessKeyId: "",
	secretAccessKey: "",
	prefix: "",
};

describe("source form schema", () => {
	test("derives conditional local and SFTP field errors", () => {
		const schema = createSourceFormSchema(true);
		expect(schema.safeParse({ ...validSourceValues, path: "" }).success).toBe(
			false,
		);
		expect(
			schema.safeParse({
				...validSourceValues,
				type: "sftp",
				path: "",
			}).success,
		).toBe(false);
		expect(schema.safeParse(validSourceValues).success).toBe(true);
	});

	test("requires S3 secrets only when creating a source", () => {
		const s3Values: SourceFormValues = {
			...validSourceValues,
			type: "s3",
			path: "",
			bucket: "images",
			region: "us-east-1",
		};
		expect(createSourceFormSchema(true).safeParse(s3Values).success).toBe(
			false,
		);
		expect(createSourceFormSchema(false).safeParse(s3Values).success).toBe(
			true,
		);
	});
});

describe("upload form schema", () => {
	test("validates filename and optional URL through Zod Standard Schema", () => {
		expect(
			uploadFormSchema.safeParse({
				filename: "image.png",
				description: "",
				sourceUrl: "",
				conflictResolution: "skip",
			}).success,
		).toBe(true);
		expect(
			uploadFormSchema.safeParse({
				filename: "",
				description: "",
				sourceUrl: "not-a-url",
				conflictResolution: "skip",
			}).success,
		).toBe(false);
	});
});

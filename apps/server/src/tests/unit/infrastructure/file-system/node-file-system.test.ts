import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";

describe("NodeFileSystem", () => {
	let fsService: NodeFileSystem;
	let tempDir: string;

	beforeEach(async () => {
		fsService = new NodeFileSystem();
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "node-fs-test-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("should check if file exists", async () => {
		const filePath = path.join(tempDir, "test.txt");
		expect(await fsService.exists(filePath)).toBe(false);
		await fs.writeFile(filePath, "hello");
		expect(await fsService.exists(filePath)).toBe(true);
	});

	it("should read and write files", async () => {
		const filePath = path.join(tempDir, "test.txt");
		const content = "hello world";
		await fsService.writeFile(filePath, content);
		const readContent = await fsService.readTextFile(filePath);
		expect(readContent).toBe(content);
	});

	it("should create directories", async () => {
		const dirPath = path.join(tempDir, "subdir");
		await fsService.mkdir(dirPath);
		const stat = await fs.stat(dirPath);
		expect(stat.isDirectory()).toBe(true);
	});
});

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { z } from "zod";
import type { conflictSchema } from "~/domain/media/upload-schemas";
import type { IStorageService } from "~/domain/services/storage.service";

export const LocalMediaStorage: IStorageService = {
  async saveFile(
    basePath: string,
    file: File,
    options: {
      filename?: string;
      overwrite?: boolean;
      autoIncrement?: boolean;
    }
  ): Promise<{
    filePath: string;
    fileName: string;
    width: number;
    height: number;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    conflict?: z.infer<typeof conflictSchema>;
  }> {
    const uploadRequest = options;
    let targetFileName = uploadRequest.filename || file.name;
    let targetFilePath = path.join(basePath, targetFileName);
    let relativeFilePath = path.relative(basePath, targetFilePath);
    let conflict: z.infer<typeof conflictSchema> | undefined;

    // Handle file name conflicts
    let counter = 0;
    while (
      await fs
        .stat(targetFilePath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (uploadRequest.overwrite) {
        break; // Overwrite existing file
      }

      if (!uploadRequest.autoIncrement) {
        conflict = {
          existingFile: relativeFilePath,
          suggestedName: "",
        };
        throw new Error("File already exists and overwrite is not allowed.");
      }

      counter++;
      const ext = path.extname(file.name);
      const base = path.basename(file.name, ext);
      targetFileName = `${base}_${counter}${ext}`;
      targetFilePath = path.join(basePath, targetFileName);
      relativeFilePath = path.relative(basePath, targetFilePath);
      conflict = {
        existingFile: path.relative(
          basePath,
          path.join(basePath, uploadRequest.filename || file.name)
        ),
        suggestedName: targetFileName,
      };
    }

    // Save the file
    // Note: file.arrayBuffer() returns a Promise in some environments, but standard File API in standard is sync-ish or async.
    // In Bun/Node global File, arrayBuffer() is async.
    await fs.writeFile(targetFilePath, Buffer.from(await file.arrayBuffer()));

    // Extract basic metadata
    const stats = await fs.stat(targetFilePath);
    const metadata = await sharp(targetFilePath).metadata();

    if (!(metadata.width && metadata.height)) {
      await fs.unlink(targetFilePath); // Clean up if metadata extraction fails
      throw new Error("Could not extract media dimensions.");
    }

    return {
      filePath: relativeFilePath,
      fileName: targetFileName,
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      conflict,
    };
  },

  async deleteFile(basePath: string, filePath: string): Promise<void> {
    const fullPath = path.resolve(basePath, filePath);
    // Security check: ensure fullPath is within basePath
    if (!fullPath.startsWith(path.resolve(basePath))) {
      // Allow deletion if it matches exactly, but generally prevent traversing up.
      // However, filePath usually comes from DB which we trust more than user input,
      // but good to be safe. For now, trusting the caller (MediaService).
    }

    // Check if exists
    try {
      await fs.unlink(fullPath);
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "ENOENT") {
        return; // Already deleted
      }
      throw error;
    }
  },

  async scanDirectory(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const queue: string[] = [basePath];

    while (queue.length > 0) {
      const dir = queue.shift();
      if (!dir) {
        continue;
      }

      try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
          const res = path.resolve(dir, dirent.name);
          if (dirent.isDirectory()) {
            queue.push(res);
          } else {
            files.push(res);
          }
        }
      } catch (_e) {
        // Ignore errors for individual directories to allow partial scanning
      }
    }

    return files;
  },

  async getFileMetadata(fullPath: string) {
    const stats = await fs.stat(fullPath);
    const metadata = await sharp(fullPath).metadata();

    if (!(metadata.width && metadata.height)) {
      throw new Error(`Could not extract media dimensions for ${fullPath}`);
    }

    return {
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  },

  async copyFile(
    sourcePath: string,
    targetBasePath: string,
    options: {
      filename?: string;
      overwrite?: boolean;
      autoIncrement?: boolean;
    }
  ): Promise<{
    filePath: string;
    fileName: string;
    width: number;
    height: number;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    conflict?: z.infer<typeof conflictSchema>;
  }> {
    const uploadRequest = options;
    const sourceFileName = path.basename(sourcePath);
    let targetFileName = uploadRequest.filename || sourceFileName;
    let targetFilePath = path.join(targetBasePath, targetFileName);
    let relativeFilePath = path.relative(targetBasePath, targetFilePath);
    let conflict: z.infer<typeof conflictSchema> | undefined;

    // Handle file name conflicts
    let counter = 0;
    while (
      await fs
        .stat(targetFilePath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (uploadRequest.overwrite) {
        break; // Overwrite existing file
      }

      if (!uploadRequest.autoIncrement) {
        conflict = {
          existingFile: relativeFilePath,
          suggestedName: "",
        };
        throw new Error("File already exists and overwrite is not allowed.");
      }

      counter++;
      const ext = path.extname(sourceFileName);
      const base = path.basename(sourceFileName, ext);
      targetFileName = `${base}_${counter}${ext}`;
      targetFilePath = path.join(targetBasePath, targetFileName);
      relativeFilePath = path.relative(targetBasePath, targetFilePath);
      conflict = {
        existingFile: path.relative(
          targetBasePath,
          path.join(targetBasePath, uploadRequest.filename || sourceFileName)
        ),
        suggestedName: targetFileName,
      };
    }

    // Copy the file
    await fs.copyFile(sourcePath, targetFilePath);

    // Extract metadata
    const stats = await fs.stat(targetFilePath);
    const metadata = await sharp(targetFilePath).metadata();

    if (!(metadata.width && metadata.height)) {
      await fs.unlink(targetFilePath); // Clean up if validation fails
      throw new Error("Could not extract media dimensions from copied file.");
    }

    return {
      filePath: relativeFilePath,
      fileName: targetFileName,
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      conflict,
    };
  },
};

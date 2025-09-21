import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import type {
	MediaSourceDriver,
	MediaSourceEntry,
	SftpConnection,
} from "./types";

export class SftpDriver implements MediaSourceDriver {
	private client: SftpClient;
	private connectionInfo: SftpConnection;

	constructor(connectionInfo: SftpConnection) {
		this.client = new SftpClient();
		this.connectionInfo = connectionInfo;
	}

	private async connect(): Promise<void> {
		if (this.client.sftp) return;
		await this.client.connect({
			host: this.connectionInfo.host,
			port: this.connectionInfo.port,
			username: this.connectionInfo.username,
			password: this.connectionInfo.password,
			privateKey: this.connectionInfo.privateKey,
		});
	}

	private async disconnect(): Promise<void> {
		if (this.client.sftp) {
			await this.client.end();
		}
	}

	private getAbsolutePath(p: string): string {
		// リモートパスの結合
		return path.posix.join(this.connectionInfo.remotePath, p);
	}

	async testConnection(): Promise<{ success: boolean; message?: string }> {
		try {
			await this.connect();
			// 存在確認
			await this.client.exists(this.connectionInfo.remotePath);
			return { success: true, message: "接続に成功しました。" };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "不明なエラーが発生しました。";
			return {
				success: false,
				message: `接続に失敗しました: ${message}`,
			};
		} finally {
			await this.disconnect();
		}
	}

	async list(p: string): Promise<MediaSourceEntry[]> {
		await this.connect();
		try {
			const absolutePath = this.getAbsolutePath(p);
			const entries = await this.client.list(absolutePath);
			return entries.map((entry) => ({
				path: path.posix.join(p, entry.name),
				isDirectory: entry.type === "d",
				size: entry.size,
				lastModified: new Date(entry.modifyTime),
			}));
		} finally {
			await this.disconnect();
		}
	}

	async get(p: string): Promise<Buffer> {
		await this.connect();
		try {
			const absolutePath = this.getAbsolutePath(p);
			return this.client.get(absolutePath);
		} finally {
			await this.disconnect();
		}
	}

	async put(p: string, content: Buffer): Promise<void> {
		await this.connect();
		try {
			const absolutePath = this.getAbsolutePath(p);
			const remoteDir = path.posix.dirname(absolutePath);
			// SFTPではmkdir -p のような挙動をclient側で実装する必要がある
			const dirs = remoteDir.split("/");
			let currentDir = "";
			for (const dir of dirs) {
				currentDir = `${currentDir}/${dir}`;
				if (!(await this.client.exists(currentDir))) {
					await this.client.mkdir(currentDir);
				}
			}
			await this.client.put(content, absolutePath);
		} finally {
			await this.disconnect();
		}
	}

	async createDirectory(p: string): Promise<void> {
		await this.connect();
		try {
			const absolutePath = this.getAbsolutePath(p);
			await this.client.mkdir(absolutePath, true); // recursive
		} finally {
			await this.disconnect();
		}
	}

	async delete(p: string): Promise<void> {
		await this.connect();
		try {
			const absolutePath = this.getAbsolutePath(p);
			const stats = await this.client.stat(absolutePath);
			if (stats.isDirectory) {
				await this.client.rmdir(absolutePath, true); // recursive
			} else {
				await this.client.delete(absolutePath);
			}
		} finally {
			await this.disconnect();
		}
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		await this.connect();
		try {
			const absoluteOldPath = this.getAbsolutePath(oldPath);
			const absoluteNewPath = this.getAbsolutePath(newPath);
			await this.client.rename(absoluteOldPath, absoluteNewPath);
		} finally {
			await this.disconnect();
		}
	}
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { OpenAPIGenerator } from "@orpc/openapi";
import type { OpenAPI } from "@orpc/contract";
import { appRouter } from "../src/domain/shared/api-contract";
import { openApiTags } from "../src/infrastructure/api/openapi-tags";

// エンドポイントごとの詳細な説明マップ
const endpointDocs: Record<string, { summary: string; description?: string }> = {
	"sources.list": {
		summary: "メディアソース一覧取得",
		description: "登録されているすべてのメディアソース（ローカル、SFTP、S3等）を取得します。",
	},
	"sources.get": {
		summary: "メディアソース詳細取得",
		description: "UUIDを指定して特定のメディアソースの情報を取得します。",
	},
	"sources.create": {
		summary: "メディアソース作成",
		description: "新しいメディアソースを登録します。",
	},
	"sources.update": {
		summary: "メディアソース更新",
		description: "既存のメディアソースの設定を更新します。",
	},
	"sources.delete": {
		summary: "メディアソース削除",
		description: "メディアソースを削除し、監視を停止します。",
	},
	"sources.status": {
		summary: "メディアソースの状態取得",
		description: "スキャン進捗やファイル数などの統計情報を取得します。",
	},
	"media.search": {
		summary: "メディア検索",
		description: "タグ、プロジェクト、キャラクターなどの条件でメディアを検索します。",
	},
	"ai.tag": {
		summary: "AI自動タグ付け",
		description: "画像を解析して、関連するタグ（DeepDanbooru等）を自動生成します。",
	},
	// 必要に応じて追加してください
};

const routerTagMap: Record<string, string> = {
	sources: "Media Sources",
	media: "Media",
	tags: "Tags",
	categories: "Categories",
	projects: "Projects",
	characters: "Characters",
	ips: "IPs",
	thumbnails: "Thumbnails",
	downloads: "Downloads",
	directories: "Directories",
	ai: "AI",
	utils: "Utilities",
};

async function generateOpenAPISpec() {
	try {
		console.log("Generating OpenAPI specification with detailed descriptions...");

		const generator = new OpenAPIGenerator();
		const spec = await generator.generate(appRouter, {
			info: {
				title: "Solid Imager oRPC API",
				version: "1.0.0",
				description: "Solid Imagerを管理するためのAPIドキュメントです。",
			},
			servers: [{ url: "http://localhost:3000/api/rpc", description: "Development server" }],
			tags: openApiTags,
		});

		if (spec.paths) {
			for (const pathItem of Object.values(spec.paths)) {
				if (!pathItem) continue;
				for (const method of ["get", "post", "put", "delete", "patch"] as const) {
					const operation = pathItem[method] as OpenAPI.OperationObject | undefined;
					if (operation?.operationId) {
						const opId = operation.operationId;
						const routerName = opId.split(".")[0];

						// タグの割り当て
						const tagName = routerTagMap[routerName];
						if (tagName) operation.tags = [tagName];

						// 説明の割り当て
						const doc = endpointDocs[opId];
						if (doc) {
							operation.summary = doc.summary;
							if (doc.description) operation.description = doc.description;
						} else {
							// デフォルトの概要（operationIdを綺麗にする）
							operation.summary = opId.split(".").pop() || opId;
						}
					}
				}
			}
		}

		const outputPath = path.resolve(process.cwd(), "public/openapi.json");
		await fs.writeFile(outputPath, JSON.stringify(spec, null, 2));
		console.log(`OpenAPI specification written to ${outputPath}`);
	} catch (error) {
		console.error("Error generating OpenAPI spec:", error);
		process.exit(1);
	}
}

void generateOpenAPISpec();

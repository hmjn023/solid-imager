# Safe DTO パターン

APIレスポンスから機密情報を除外するためのパターン。接続情報（パスワード・秘密鍵・アクセスキー等）をクライアントへ返さないために使用。

## なぜ必要か

`MediaSource` はDBに接続情報（SFTP パスワード、S3 シークレットキー等）を保存している。これをそのままAPIレスポンスとして返すと機密情報が漏洩する。

```typescript
// packages/core/src/domain/sources/schemas.ts
export const sftpConnectionSchema = z.object({
	host: z.string(),
	port: z.number(),
	username: z.string(),
	password: z.string().optional(), // ← 機密
	privateKey: z.string().optional(), // ← 機密
	remotePath: z.string(),
});

export const s3ConnectionSchema = z.object({
	region: z.string(),
	bucket: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(), // ← 機密
	prefix: z.string().optional(),
});
```

## 実装パターン

### 1. Safe型をcoreで定義

```typescript
// packages/core/src/domain/sources/schemas.ts
// 機密フィールドを含まないSafe版スキーマ
export const safeLocalConnectionSchema = z.object({
  path: z.string(),
});

export const safeSftpConnectionSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string(),
  remotePath: z.string(),
  // password・privateKey は除外
});

export const safeS3ConnectionSchema = z.object({
  bucket: z.string(),
  region: z.string(),
  prefix: z.string().optional(),
  // secretAccessKey・accessKeyId は除外
});

export type SafeMediaSource = ...; // 機密なし版
```

### 2. ルーターで変換関数を定義・適用

```typescript
// apps/server/src/infrastructure/api/routers/sources-router.ts
function toSafeMediaSource(source: MediaSource): SafeMediaSource {
  const { connectionInfo, ...rest } = source;
  const info = connectionInfo as any;

  if (source.type === "local") {
    return { ...rest, connectionInfo: { path: info.path } };
  }
  if (source.type === "sftp") {
    return {
      ...rest,
      connectionInfo: {
        host: info.host,
        port: info.port,
        username: info.username,
        remotePath: info.remotePath,
        // password・privateKey は含めない
      },
    };
  }
  if (source.type === "s3") {
    return {
      ...rest,
      connectionInfo: {
        bucket: info.bucket,
        region: info.region,
        prefix: info.prefix,
        // secretAccessKey・accessKeyId は含めない
      },
    };
  }
}

export const sourcesRouter = {
  list: os.handler(async () => {
    const sources = await MediaSourceService.list();
    return sources.map(toSafeMediaSource); // ← 変換して返す
  }),

  get: os.input(...).handler(async ({ input }) => {
    const source = await MediaSourceService.get(input.id);
    return toSafeMediaSource(source); // ← 変換して返す
  }),
};
```

## 適用すべきケース

| データ             | 機密フィールド                   |
| ------------------ | -------------------------------- |
| MediaSource (SFTP) | `password`, `privateKey`         |
| MediaSource (S3)   | `secretAccessKey`, `accessKeyId` |
| User               | `password`（ハッシュ含む）       |
| AppConfig          | APIキー等の認証情報              |

## アンチパターン

```typescript
// ❌ DBエンティティをそのまま返す
return await MediaSourceService.get(id); // connectionInfoに機密情報が含まれる

// ❌ 型アサーションで誤魔化す
return source as SafeMediaSource; // 実際には機密フィールドが残る

// ✅ 明示的に変換関数を通す
return toSafeMediaSource(await MediaSourceService.get(id));
```

## ルール

- oRPCルーターの返り値は**必ず**Safe DTOを通す
- 変換関数（`toSafeXxx`）はルーターファイル内に定義する
- Safe型は `packages/core/src/domain/{entity}/schemas.ts` に定義し、全アプリで共有する

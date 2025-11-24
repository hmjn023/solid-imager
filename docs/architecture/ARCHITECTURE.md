# アーキテクチャドキュメント

**プロジェクト**: solid-imager  
**最終更新日**: 2025-11-23  
**アーキテクチャスタイル**: クリーンアーキテクチャ / ヘキサゴナルアーキテクチャ

## 概要

このプロジェクトは、クリーンアーキテクチャとヘキサゴナルアーキテクチャの原則に触発されたレイヤードアーキテクチャパターンに従っています。コードベースは、明確な関心事の分離と明確に定義された依存関係ルールを持つ異なるレイヤーに編成されています。

## アーキテクチャ原則

1.  **依存関係の方向**: 依存関係はドメインレイヤーに向かって内側に流れます
    - プレゼンテーション → アプリケーション → ドメイン ← インフラストラクチャ
2.  **ドメインの独立性**: ドメインレイヤーは外部依存関係を持ちません
3.  **テスト容易性**: 各レイヤーは独立してテストできます
4.  **保守性**: 明確な境界により、コードの理解と変更が容易になります
5.  **柔軟性**: インフラストラクチャはビジネスロジックに影響を与えることなく交換できますts
│       ├── media-source-service.ts
│       ├── thumbnail-service.ts
│       └── ... (合計19サービス)
│
├── infrastructure/      # 外部統合、I/O操作
│   ├── storage/         # ストレージドライバー (ローカル、SFTP、S3)
│   ├── api-clients/     # フロントエンド用APIクライアント層
│   │   ├── shared/      # 共通ユーティリティ (base-client, types, endpoints)
│   │   ├── sources-api.ts
│   │   ├── media-api.ts
│   │   └── ...
│   ├── jobs/            # バックグラウンドジョブ処理
│   └── db/              # データベースアクセスレイヤー
│
├── presentation/        # UIレイヤー、ルート、コンポーネント
│   ├── routes/          # APIルートとページ (レイヤーの外部)
│   ├── components/      # UIコンポーネント (レイヤーの外部)
│   └── utils/           # プレゼンテーションユーティリティ (cn.ts)
│
└── shared/              # クロスカッティングの関心事 (将来の使用)
    ├── types/
    └── constants/
```

## レイヤーの責任

### 1. ドメインレイヤー (`src/domain/`)

**目的**: ビジネスロジック、ドメインモデル、および検証ルールが含まれます。I/Oのない純粋な関数です。

**特徴**:
- 他のレイヤーへの依存関係なし
- 純粋関数 (決定論的、副作用なし)
- ビジネスルールと検証
- ドメイン固有の型とスキーマ

**ファイル** (合計17):
- `media/types.ts` - メディアドメイン型 (Media, MediaMetadataなど)
- `media/schemas.ts` - メディアのZod検証スキーマ
- `media/processing/image-processor.ts` - 画像処理ロジック
- `media/utils/path-utils.ts` - パス操作ユーティリティ
- `media/utils/hash-utils.ts` - ハッシュユーティリティ
- `sources/types.ts` - ソース型 (MediaSourceInfo, ConnectionInfo)
- `sources/schemas.ts` - ソース検証スキーマ
- `shared/types.ts` - クロスドメイン型 (UUID, AppConfigなど)
- `shared/validation.ts` - スキーマ検証ユーティリティ
- タグ、カテゴリ、キャラクター、IPのドメイン固有の型とスキーマ

**ガイドライン**:
- ✅ DO: 純粋な関数を記述する
- ✅ DO: ビジネスルールと検証を定義する
- ✅ DO: ドメイン固有の型を作成する
- ❌ DON'T: インフラストラクチャまたはアプリケーションレイヤーからインポートする
- ❌ DON'T: I/O操作を実行する
- ❌ DON'T: データベースまたは外部APIにアクセスする

**例**:
```typescript
// ✅ 良い例: 純粋なドメインロジック
export const calculateAspectRatio = (width: number, height: number): number => {
  return width / height;
};

// ❌ 悪い例: ドメインレイヤーでのI/O
export const getMediaFromDatabase = async (id: string) => {
  return await db.select().from(media).where(eq(media.id, id));
};
```

### 2. アプリケーションレイヤー (`src/application/`)

**目的**: ユースケースをオーケストレーションし、ドメインとインフラストラクチャの間を調整します。

**特徴**:
- ドメインレイヤーに依存
- 依存性注入またはインポートを介してインフラストラクチャを使用
- 複雑なワークフローを調整
- トランザクション境界

**ファイル** (合計19):
- ビジネス操作をオーケストレーションするサービスファイル:
  - `media-service.ts` - メディア管理操作
  - `media-source-service.ts` - ソース管理
  - `thumbnail-service.ts` - サムネイル生成オーケストレーション
  - `analytics-service.ts`、`bulk-operation-service.ts`など

**ガイドライン**:
- ✅ DO: ドメインロジックをインフラストラクチャとオーケストレーションする
- ✅ DO: トランザクション境界を処理する
- ✅ DO: ユースケースを実装する
- ✅ DO: ドメインおよびインフラストラクチャレイヤーからインポートする
- ❌ DON'T: ビジネスロジックを含める (ドメインに委譲する)
- ❌ DON'T: インフラストラクチャの詳細に直接アクセスする (抽象化を使用する)

**例**:
```typescript
// ✅ 良い例: サービスはドメイン + インフラストラクチャをオーケストレーションする
import { extractMetadata } from '~/domain/media/processing/image-processor';
import { createDriverFromSource } from '~/infrastructure/storage/factory';
import { db } from '~/infrastructure/db';
import { validateSourceId } from '~/domain/sources/schemas';

export async function processMedia(sourceId: string, filePath: string) {
  const validatedId = validateSourceId(sourceId);
  const driver = await createDriverFromSource(validatedId);
  const file = await driver.readFile(filePath);
  const metadata = extractMetadata(file);
  return await db.insert(media).values({
    sourceId: validatedId,
    filePath,
    metadata
  });
}
```

### 3. インフラストラクチャレイヤー (`src/infrastructure/`)

**目的**: 外部統合、I/O操作、および技術的機能を実装します。

**特徴**:
- ドメインレイヤーに依存 (型とインターフェースの場合)
- アプリケーションレイヤーから独立
- 外部システム (DB、ファイルシステム、API) を処理
- アダプターとドライバーを含む

**ファイル** (合計21):
- `storage/` - ストレージドライバー (local.ts, sftp.ts, s3.ts, factory.ts, types.ts)
- `api-clients/` - フロントエンド用APIクライアント (sources-api.ts, media-api.tsなど)
- `jobs/` - バックグラウンドジョブ処理とSSE管理
  - `job-manager.ts` - ジョブキュー管理
  - `thumbnails.ts` - サムネイル生成ジョブ
  - `tag-extraction.ts` - タグ抽出ジョブ
  - `download-jobs.ts` - 画像ダウンロードジョブ
  - `sse-manager.ts` - Server-Sent Events (SSE) クライアント管理とイベント配信、ファイルシステム監視
  - `file-watcher-service.ts` - ファイルシステム監視のコールバック処理
- `db/` - データベースアクセス (index.ts, schema.ts)

#### Server-Sent Events (SSE) インフラストラクチャ

リアルタイム更新のためのSSE実装:

- **目的**: サムネイル生成完了などのバックグラウンドジョブの進捗をフロントエンドにリアルタイムで通知
- **実装**: `src/infrastructure/jobs/sse-manager.ts`
  - クライアント接続の管理 (`addClient`, `removeClient`)
  - メディアソースごとのイベント配信 (`sendEvent`)
  - `ReadableStreamDefaultController`を使用したストリーミング
  - **ファイルシステム監視** (`startFileSystemMonitoring`, `stopFileSystemMonitoring`):
    - `chokidar`を使用してローカルメディアソースディレクトリを監視
    - ファイルの追加、削除、変更を検知
    - コールバック関数を実行してメディア登録・削除・更新を自動化
- **APIエンドポイント**: `/api/sse/[mediaSourceId]`
  - GET リクエストでSSE接続を確立
  - クライアント切断時の自動クリーンアップ
- **イベントタイプ**:
  - `thumbnail-generated`: サムネイル生成完了時に送信
  - `media-added`: ファイルシステムに新しいメディアファイルが追加された時に送信
  - `media-deleted`: ファイルシステムからメディアファイルが削除された時に送信
  - `media-changed`: ファイルシステムのメディアファイルが変更された時に送信
  - `watcher-error`: ファイルシステム監視でエラーが発生した時に送信
- **フロントエンド統合**: `EventSource` APIを使用してSSE接続を確立し、イベント受信時にデータを再取得
- **自動監視**:
  - アプリケーション起動時に既存のローカルメディアソースの監視を自動開始 (`entry-server.tsx`)
  - メディアソース作成時に監視を自動開始
  - メディアソース削除時に監視を自動停止


**ガイドライン**:
- ✅ DO: 技術的機能を実装する
- ✅ DO: I/O操作を処理する
- ✅ DO: データ構造にドメイン型を使用する
- ✅ DO: ドメイン固有のエラーをスローする
- ❌ DON'T: アプリケーションレイヤーからインポートする
- ❌ DON'T: ビジネスロジックを含める

**例**:
```typescript
// ✅ 良い例: インフラストラクチャアダプター
import * as fs from 'node:fs/promises';
import type { MediaSourceDriver } from './types';

export class LocalDriver implements MediaSourceDriver {
  constructor(private basePath: string) {}

  async readFile(path: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.getAbsolutePath(path));
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }
  
  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await fs.access(this.basePath);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: `Directory not accessible: ${error}` 
      };
    }
  }

  private getAbsolutePath(relativePath: string): string {
    return `${this.basePath}/${relativePath}`;
  }
}
```

#### APIクライアント層 (`src/infrastructure/api-clients/`)

フロントエンドからバックエンドAPIへの通信を担当します。

- **型安全性**: Zodスキーマを使用してAPIレスポンスをバリデーションし、TypeScriptの型を保証します。
- **統一されたエラーハンドリング**: `shared/base-client.ts` により、ネットワークエラーやAPIエラーを統一的に処理します。
- **SSR対応**: サーバーサイドレンダリング時とクライアントサイドレンダリング時で適切なURL解決を行います。
- **構成**:
    - `shared/`: 共通ユーティリティ (`base-client.ts`, `types.ts`, `endpoints.ts`)
    - `*_api.ts`: 各ドメインごとのAPIクライアント関数群

### 4. プレゼンテーションレイヤー (`src/presentation/`)

**目的**: UIレンダリングに特化したユーティリティを含む、ユーザーインターフェースの関心事。

**特徴**:
- アプリケーションおよびドメインレイヤーに依存
- UI固有のロジックを含む
- ユーザー入力/出力を処理

**ファイル** (合計1):
- `utils/cn.ts` - Tailwind CSSクラスマージユーティリティ

**注**: ルート (`src/routes/`) とコンポーネント (`src/components/`) は概念的にはプレゼンテーションレイヤーの一部ですが、フレームワークの慣例 (SolidStart) によりプロジェクトルートに残ります。

**ガイドライン**:
- ✅ DO: UIレンダリングロジックを処理する
- ✅ DO: 表示用にデータをフォーマットする
- ✅ DO: ユーザー入力を処理する
- ✅ DO: 必要に応じて任意のレイヤーからインポートする
- ❌ DON'T: ビジネスロジックを含める

### 5. 共有レイヤー (`src/shared/`)

**目的**: 複数のレイヤーで使用されるクロスカッティングの関心事。

**ステータス**: 将来の使用のためにディレクトリ構造が作成されました。現在は空です。

**意図された使用**:
- すべてのレイヤーで使用される共通の型
- アプリケーション全体の定数
- 特定のドメインに属さない共有ユーティリティ

## 依存関係ルール

### 許可された依存関係

```
プレゼンテーションレイヤー
    ↓ (からインポート可能)
アプリケーションレイヤー
    ↓ (からインポート可能)
ドメインレイヤー ← インフラストラクチャレイヤー
    (からインポート可能)
```

### 禁止された依存関係

- ❌ ドメイン → インフラストラクチャ
- ❌ ドメイン → アプリケーション
- ❌ ドメイン → プレゼンテーション
- ❌ インフラストラクチャ → アプリケーション
- ❌ インフラストラクチャ → プレゼンテーション

## 移行の概要

### 以前 (古い構造)

```
src/
├── lib/              # 混在した関心事
│   ├── api/          # APIクライアント + ビジネスロジック
│   ├── drivers/      # ストレージドライバー
│   ├── helpers/      # 混在したユーティリティ
│   ├── types.ts      # すべての型が1つのファイルに
│   ├── schemas.ts    # すべてのスキーマが1つのファイルに
│   └── utils.ts      # 単一のユーティリティ
├── services/         # アプリケーションサービス (適切に編成)
├── db/               # データベース
└── utils/            # 空
```

**問題点**:
- ビジネスロジックとインフラストラクチャの混在 (src/lib/api/media.ts)
- ドメインごとに整理されていない型とスキーマ
- 複数のファイルに散らばったヘルパー関数
- ドメインとインフラストラクチャの明確な分離がない

### 以後 (新しい構造)

**改善点**:
- ✅ 明確な関心事の分離 (4つの異なるレイヤー)
- ✅ ドメインロジックがI/Oから分離
- ✅ ドメインごとに整理された型とスキーマ
- ✅ インフラストラクチャアダプターが明確に分離
- ✅ すべてのアーキテクチャ境界が強制される
- ✅ 58ファイルが5つのレイヤーに整理 (82から減少し、重複を排除)

## 新しいコードの追加

### 新しいドメインコンセプトの追加

1.  `src/domain/{concept}/`にディレクトリを作成
2.  ドメイン型用の`types.ts`を追加
3.  検証スキーマ用の`schemas.ts`を追加
4.  必要に応じてドメインロジックファイルを追加

**例**: 「コレクション」ドメインの追加
```
src/domain/collections/
├── types.ts           # Collection, CollectionItem型
├── schemas.ts         # Collection検証スキーマ
└── utils/
    └── collection-utils.ts  # 純粋なコレクションロジック
```

### 新しいサービスの追加

1.  `src/application/services/`にファイルを作成
2.  ドメイン型とスキーマをインポート
3.  インポートを介してインフラストラクチャを使用
4.  ビジネス操作をオーケストレーション

**例**: コレクションサービスの追加
```typescript
// src/application/services/collection-service.ts
import type { Collection } from "~/domain/collections/types";
import { collectionSchema } from "~/domain/collections/schemas";
import { db } from "~/infrastructure/db";

export async function createCollection(data: unknown): Promise<Collection> {
  const validated = collectionSchema.parse(data);
  return await db.insert(collections).values(validated);
}
```

### インフラストラクチャ統合の追加

1.  `src/infrastructure/{type}/`にアダプターを作成
2.  ドメインで定義されたインターフェースを実装
3.  データ構造にドメイン型を使用

**例**: 新しいストレージドライバーの追加
```typescript
// src/infrastructure/storage/dropbox.ts
import type { MediaSourceDriver } from "./types";

export class DropboxDriver implements MediaSourceDriver {
  async readFile(path: string): Promise<Buffer> {
    // Dropbox SDKを使用した実装
  }
  
  async testConnection(): Promise<{ success: boolean }> {
    // Dropbox接続をテスト
  }
}
```

## テスト戦略

### ドメインレイヤーテスト
- ビジネスロジックの正確性に焦点を当てる
- 純粋な入力/出力アサーションを使用
- モックは不要 (純粋関数)

### アプリケーションレイヤーテスト
- インフラストラクチャの依存関係をモックする
- ユースケースのオーケストレーションをテストする
- エラー処理を検証する

### インフラストラクチャレイヤーテスト
- 実際の外部システムとの統合テスト (テストデータベースを使用)
- アダプターの動作をテストする
- I/O障害のエラー処理を検証する

### プレゼンテーションレイヤーテスト
- UIコンポーネントテスト
- ユーザーインタラクションフロー
- フォーマット/表示ロジック

## 一般的なパターン

### 依存性注入

サービスはコンストラクタまたは関数パラメータを介して依存関係を受け取ります。

```typescript
export async function processMediaWithStorage(
  storage: MediaSourceDriver,
  filePath: string
) {
  const file = await storage.readFile(filePath);
  return processFile(file);
}
```

### エラー処理

プレゼンテーションレイヤーでキャッチできるドメイン固有のエラーをスローします。

```typescript
// ドメインレイヤー
export class MediaNotFoundError extends Error {
  constructor(id: string) {
    super(`Media ${id} not found`);
  }
}

// アプリケーションレイヤー
export async function getMedia(id: string): Promise<Media> {
  const media = await db.select().from(media).where(eq(media.id, id));
  if (!media) throw new MediaNotFoundError(id);
  return media;
}

// プレゼンテーションレイヤー (ルート)
try {
  return json(await getMedia(params.id));
} catch (error) {
  if (error instanceof MediaNotFoundError) {
    return json({ error: error.message }, { status: 404 });
  }
  throw error;
}
```

### 検証パターン

エントリポイントでドメインレイヤーのZodスキーマを使用します。

```typescript
// ドメイン
export const createMediaSchema = z.object({
  sourceId: z.string().uuid(),
  filePath: z.string().min(1),
  // ...
});

// アプリケーションサービス
export async function createMedia(data: unknown) {
  const validated = createMediaSchema.parse(data); // 無効な場合はZodErrorをスロー
  return await db.insert(media).values(validated);
}

// ルートハンドラー
export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json();
    return json(await createMedia(body));
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    throw error;
  }
}
```

## アーキテクチャ決定記録

このアーキテクチャの根拠については、[ADR-001: クリーンアーキテクチャの採用](./ADR-001-clean-architecture.md)を参照してください。

## 参照

- [クリーンアーキテクチャ (ロバート・C・マーチン)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [ヘキサゴナルアーキテクチャ (アリスター・コックバーン)](https://alistair.cockburn.us/hexagonal-architecture/)
- [機能仕様](../../specs/005-src-lib-utils/spec.md)
- [実装計画](../../specs/005-src-lib-utils/plan.md)
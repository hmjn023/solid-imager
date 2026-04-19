# packages/core

`@solid-imager/core` — システム全体の共有ドメインモデル層。他パッケージへの依存を持たず、すべてのアプリが参照する。

## 責務

- Zodスキーマによるドメインモデル定義
- リポジトリインターフェース定義
- ドメインエラークラス
- ドメインサービスインターフェース（AI・ストレージ等）
- ユーティリティ関数（ファイル名生成、メタデータ解析等）

## ドメイン一覧

`packages/core/src/domain/` 配下：

| ディレクトリ | 内容 |
|---|---|
| `media/` | メディアスキーマ・アップロードスキーマ・各種ユーティリティ |
| `sources/` | メディアソーススキーマ・イベント・Solid Store |
| `tags/` | タグスキーマ・タグ抽出ロジック |
| `characters/` | キャラクタースキーマ |
| `ips/` | IP（知的財産）スキーマ |
| `authors/` | 作者スキーマ |
| `categories/` | カテゴリスキーマ |
| `collections/` | コレクションスキーマ |
| `projects/` | プロジェクトスキーマ |
| `users/` | ユーザースキーマ |
| `config/` | アプリ設定スキーマ |
| `search/` | 検索クエリスキーマ・検索ロジック |
| `tagging/` | AIタグ付けスキーマ・定数 |
| `errors/` | ドメインエラークラス |
| `shared/` | 共通スキーマ・APIスペック・バリデーション |

## リポジトリインターフェース

`packages/core/src/domain/repositories/` に各エンティティのCRUDインターフェースを定義。実装は `apps/server/src/infrastructure/repositories/` に置く。

| インターフェース | エンティティ |
|---|---|
| `IMediaRepository` | メディア |
| `ISourceRepository` | メディアソース |
| `ITagRepository` | タグ |
| `ICharacterRepository` | キャラクター |
| `IIpRepository` | IP |
| `IAuthorRepository` | 作者 |
| `IPresetRepository` | フィルタープリセット |
| `ICollectionRepository` | コレクション |
| `IProjectRepository` | プロジェクト |
| `IUserRepository` | ユーザー |

## ドメインエラー（`domain/errors/`）

```typescript
DomainError               // 基底クラス
├── ResourceNotFoundError // リソース未発見（resource, identifier）
├── ResourceConflictError // 重複・競合
├── ValidationError       // バリデーション失敗
└── UnexpectedError       // 予期しないエラー（originalErrorを保持）
```

## ドメインサービスインターフェース

| ファイル | インターフェース |
|---|---|
| `domain/interfaces/ai-client.ts` | AIタグ付けクライアント |
| `domain/interfaces/transaction-manager.ts` | DBトランザクション管理 |
| `interfaces/file-system.ts` | ファイルシステム操作 |
| `interfaces/media-storage.ts` | メディアストレージ（抽象） |
| `interfaces/media-manager-client.ts` | メディア管理クライアント |
| `interfaces/config-service.ts` | 設定サービス |

## メディアユーティリティ（`domain/media/utils/`）

| ファイル | 機能 |
|---|---|
| `filename-utils.ts` | メディアファイル名の生成・解析 |
| `media-type-utils.ts` | MIMEタイプ判定・分類 |
| `metadata-utils.ts` | プロンプト・メタデータ解析 |
| `path-utils.ts` | ストレージパス操作 |

## 使用方法

```typescript
import { mediaSchema, type Media } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
```

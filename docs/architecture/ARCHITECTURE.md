# アーキテクチャガイド

**プロジェクト**: solid-imager
**最終更新日**: 2025-12-31
**スタイル**: Clean Architecture / Hexagonal Architecture

## 1. 概要

solid-imager は、堅牢で保守性の高いコードベースを実現するために、**Clean Architecture（クリーンアーキテクチャ）**を採用しています。
このアーキテクチャの核心は「関心事の分離」であり、ビジネスロジック（ドメイン）を、Webフレームワーク、データベース、外部APIなどの詳細（インフラストラクチャ）から独立させることを目的としています。

### 主な原則

1.  **依存関係の方向**: 依存は常に「外側から内側」へ向かいます。ドメイン層は他のどの層にも依存しません。
2.  **テスト容易性**: ビジネスロジックはインフラやUIなしで単体テスト可能です。
3.  **独立性**: データベースやフレームワークを変更しても、ビジネスロジックには影響しません。

---

## 2. ディレクトリ構造とレイヤー

このプロジェクトはモノレポ構成を採用しており、主要なパッケージは `apps/server` と `packages/core` に分かれています。

### 2.1 パッケージ構成

*   **`packages/core`**: 共通のビジネスロジック、型定義、インターフェース。Node.js などの特定のランタイムに依存しない純粋な TypeScript コード。
*   **`apps/server`**: サーバーサイドの実装。SolidStart (Vinxi), Drizzle ORM, Node.js API を使用し、`packages/core` で定義されたインターフェースを実装します。
*   **`xtracter`**: ブラウザ拡張機能（独立したワークスペース）。

### 2.2 レイヤー構造

各パッケージ内で、以下の Clean Architecture のレイヤー構造を維持します。

```
packages/core/src/
├── domain/              # [コア] ビジネスエンティティ、スキーマ、リポジトリインターフェース
└── interfaces/          # [抽象化] インフラストラクチャへの抽象インターフェース (IFileSystem, IMediaStorage 等)

apps/server/src/
├── application/         # [統合] ユースケース、サービスクラス (ServiceRegistry で依存解決)
├── infrastructure/      # [詳細] データベース、外部API、ファイルシステムの実装 (NodeFileSystem, ServerMediaStorage)
└── presentation/        # [UI]   コンポーネント、ルート (SolidStart)
    ├── components/
    └── routes/
```

### 2.3 抽象化レイヤー

将来的な Tauri クライアント対応を見据え、以下のインフラストラクチャ操作はインターフェースを通じて抽象化されています。

*   **`IFileSystem`**: ファイルシステムの操作（読み書き、ディレクトリ操作）。
*   **`IMediaStorage`**: メディアファイルの保存、取得、メタデータ抽出。
*   **`IConfigService`**: アプリケーション設定の管理。

アプリケーション層（`MediaService` など）は、具体的な `fs` モジュールや `process.env` ではなく、これらのインターフェースに依存します。

---

## 3. 実装ルールとパターン

### 3.1 リポジトリパターン (Repository Pattern)

データの永続化には必ずリポジトリパターンを使用します。

*   **Explicit Mapping (明示的なマッピング)**:
    *   データベースから取得したオブジェクトを `as unknown as DomainModel` でキャストすることを**禁止**します。
    *   必ず `mapToDomain(dbEntity): DomainModel` のようなマッパー関数を実装し、明示的に変換してください。
*   **Domain Errors**:
    *   インフラ層で発生したエラー（例: DB接続エラー、レコードなし）は、単に投げっぱなしにするのではなく、ドメイン層で定義されたエラー（`ResourceNotFoundError`, `UnexpectedError` 等）に変換して再スローしてください。

### 3.2 依存性の注入 (Dependency Injection)

サービスは、具体的な実装クラスではなく、インターフェースに依存するように設計します。
これにより、テスト時にモック（Mock）への差し替えが容易になります。

```typescript
// 良い例
constructor(private mediaRepository: IMediaRepository) {}

// 悪い例
private mediaRepository = new DrizzleMediaRepository();
```

### 3.3 安全なAPIレスポンス (Safe DTO)

*   **機密情報の保護**:
    *   データベース上のレコードにはパスワード、APIキー、シークレットトークンなどの機密情報が含まれる場合があります。これらをそのままAPIレスポンスに含めてはいけません。
    *   必ず `SafeMediaSource` のような「安全なDTO（Data Transfer Object）」に変換し、機密情報を除外してからクライアントに返却してください。

---

## 4. データベース設計方針

（詳細は `docs/design/database-design.md` および ADR-002 参照）

*   **ID戦略**: 全てのデータベーステーブルで **UUID (v4)** を使用します。これにより、クライアント・サーバ間での同期時におけるIDの競合を防止し、オフライン環境下でのデータ作成を可能にします。
*   **多対多関係**: `media_tags`, `media_collections` のように `media_{entity}` という命名規則の中間テーブルを使用します。
*   **タイムスタンプ**:
    *   `created_at`: 原本の作成日時
    *   `modified_at`: ファイルの更新日時
    *   `indexed_at`: システムへの登録日時
    *   `updated_at`: メタデータの更新日時

---

## 5. 新機能追加フロー

機能を追加する際は、以下のステップに従ってください。

1.  **Domain**:
    *   必要なデータ構造を `schemas.ts` にZodスキーマとして定義。
    *   型を `types.ts` にエクスポート。
    *   純粋なロジック（計算や判定）が必要なら実装。
2.  **Infrastructure**:
    *   DBマイグレーションが必要なら実行。
    *   リポジトリや外部APIアダプタを実装。
3.  **Application**:
    *   サービスクラスを作成/修正し、ユースケースを実装。
    *   **ユニットテストを作成**（依存関係をモックしてテスト）。
4.  **Presentation**:
    *   APIルートを作成。
    *   UIコンポーネントを実装。

---

## 6. 関連ドキュメント (ADR)

過去のアーキテクチャ決定の経緯については、以下の記録を参照してください。

*   [ADR-001: Clean Architectureの採用](./ADR-001-clean-architecture.md)
*   [ADR-002: データベーススキーマの一貫性](./ADR-002-database-schema-consistency.md)
*   [ADR-003: 機能要件とスキーマ拡張](./ADR-003-feature-requirements-and-schema-extensions.md)
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

ソースコード (`src/`) は以下の4つの主要レイヤーに分かれています。

```
src/
├── domain/              # [コア] ビジネスロジック、型、純粋関数
├── application/         # [統合] ユースケース、サービスクラス
├── infrastructure/      # [詳細] データベース、外部API、ファイルシステム
└── presentation/        # [UI]   コンポーネント、ルート (SolidStart)
    ├── components/
    └── routes/
```

### 2.1 Domain Layer (`src/domain/`)

**責務**: ビジネスルールの定義。
**依存**: なし（標準ライブラリのみ）。

*   **内容**:
    *   `Schema-Driven Development`: Zodスキーマを定義し、そこから型 (`types.ts`) を導出します。
    *   純粋なロジック関数（例: パス計算、バリデーション）。
    *   **絶対にやってはいけないこと**: DB接続、ファイル読み書き、外部APIコール。API固有の型（Bun/Node.js固有等）への依存。

### 2.2 Application Layer (`src/application/`)

**責務**: アプリケーションのユースケース（機能）の実現。
**依存**: Domain Layer。

*   **内容**:
    *   `Services`: ドメインロジックとインフラストラクチャを組み合わせて処理を実行します（例: `MediaService`）。
    *   **依存性の注入 (DI)**: リポジトリの実装クラスではなく、インターフェースに依存します。
    *   トランザクション管理。

### 2.3 Infrastructure Layer (`src/infrastructure/`)

**責務**: 技術的詳細の実装。外部世界とのI/O。
**依存**: Domain Layer (インターフェース定義)。

*   **内容**:
    *   `Repositories`: データベースへのアクセス（Drizzle ORMを使用）。
    *   `External APIs`: 外部サービスへのクライアント。
    *   `File System`: ローカルファイルの操作（`fs` 等）。
    *   `Jobs`: バックグラウンドジョブの実装。

### 2.4 Presentation Layer (`src/components/`, `src/routes/`)

**責務**: ユーザーインターフェースとルーティング。
**依存**: Application Layer, Domain Layer。注意: 概念的にはプレゼンテーション層ですが、SolidStartの規約によりルート直下の `components` や `routes` に配置されています。

*   **内容**:
    *   UIコンポーネント (`solid-ui` / shadcn)。
    *   APIルート定義。
    *   表示ロジック、入力バリデーション。

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

*   **ID戦略**: 外部公開するエンティティ（Media, Source等）には **UUID** を使用。内部管理マスタ（Tags等）には **SERIAL** を使用するハイブリッド戦略をとります。
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
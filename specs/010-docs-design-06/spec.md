# Feature: DB操作関数の実装

## 1. Feature Description

`docs/design/06-feature-details.md` および `src/infrastructure/db/schema.ts` に基づき、アプリケーション全体で必要とされるデータベース（DB）操作関数を実装します。これにより、メディア管理、カテゴリ管理、タグ管理などの各機能におけるDBインタラクションを抽象化するデータアクセスレイヤーを構築します。

## 2. Technical Details & Implementation Plan

### Data
- **Models**: データモデルは `src/infrastructure/db/schema.ts` にて `Media`, `NewMedia`, `Tag`, `NewTag` などとして既に定義済みです。これらの型定義をそのまま利用します。
- **Contracts**: 主にDBから取得した、あるいはDBに挿入するデータ型に準拠します。APIのレスポンス等のデータコントラクトは、この実装のスコープ外です。
- **Validation**: Drizzle ORMとPostgreSQLスキーマが基本的な型検証を処理します。より複雑なビジネスルールの検証は、ドメインレイヤーでZodスキーマを用いて行いますが、このタスクの範囲外です。

### Backend
- **API Endpoints**: APIエンドポイントの実装は行いません。
- **Services**: サービスレイヤーの実装は行いません。
- **Database**:
    - **構成**: モノリシックな `db.ts` ファイルを作成する代わりに、関連する関数を `src/infrastructure/db/queries` ディレクトリ内のドメインごとのファイルに分割します。これにより、関心の分離というクリーンアーキテクチャの原則に従います。
        - `src/infrastructure/db/queries/media.ts`
        - `src/infrastructure/db/queries/mediaSources.ts`
        - `src/infrastructure/db/queries/tags.ts`
        - `src/infrastructure/db/queries/categories.ts`
        - `src/infrastructure/db/queries/characters.ts`
        - `src/infrastructure/db/queries/ips.ts`
        - `src/infrastructure/db/queries/collections.ts`
        - `src/infrastructure/db/queries/users.ts`
        - その他、必要に応じたファイル
    - **関数シグネチャ（例）**:
        ```typescript
        import type { Media, NewMedia, Tag, NewTag } from '~/infrastructure/db/schema';

        // media.ts
        export async function selectMediaById(id: string): Promise<Media | undefined>;
        export async function insertMedia(data: NewMedia): Promise<Media>;
        export async function updateMedia(id: string, data: Partial<NewMedia>): Promise<Media>;
        export async function deleteMedia(id: string): Promise<void>;

        // tags.ts
        export async function selectAllTags(): Promise<Tag[]>;
        export async function insertTag(data: NewTag): Promise<Tag>;
        ```

### Frontend
- このタスクではフロントエンドの変更はありません。

## 3. Acceptance Criteria

- [ ] AC 1: `docs/design/06-feature-details.md` にリストされているすべてのDB操作関数が実装されている。
- [ ] AC 2: 関数が `src/infrastructure/db/queries/` 内でドメイン/テーブルごとに個別のファイルに整理されている。
- [ ] AC 3: 関数がDrizzle ORMを正しく使用してデータベースと対話している。
- [ ] AC 4: 関数が `schema.ts` からエクスポートされた既存の型（`Media`, `NewMedia`など）を使用している。
- [ ] AC 5: 各関数に基本的なエラーハンドリング（DBエラーのキャッチと再スローなど）が実装されている。

## 4. Milestones

- [ ] Milestone 1: `src/infrastructure/db/queries` のディレクトリ構造を作成する。
- [ ] Milestone 2: `mediaSources` と `medias` テーブルに関連するDB関数を実装する。
- [ ] Milestone 3: `tags` と `categories` テーブルに関連するDB関数を実装する。
- [ ] Milestone 4: `ips` と `characters` テーブルに関連するDB関数を実装する。
- [ ] Milestone 5: `mediaDetails`, `mediaGenerationInfo` など、メディア関連の補助テーブルのDB関数を実装する。
- [ ] Milestone 6: `users` と `collections` テーブルに関連するDB関数を実装する。
- [ ] Milestone 7: 実装されたすべての関数の一貫性と正確性についてレビューとリファクタリングを行う。

## 5. Open Questions

- Q1: DBクエリファイルは `~/infrastructure/db/index` から `db` インスタンスを直接インポートすべきか、それとも依存性注入を介して渡すべきか？
    - A: 現状のプロジェクト構造を考慮し、シンプルにするため直接インポートする方針で問題ありません。
- Q2: 複雑なJOINやリレーションはどのように扱うべきか？
    - A: DrizzleのRelational Queries APIを可能な限り活用し、クエリを簡潔に保ちます。

## 6. Risks

- Risk 1: 複雑なクエリによるパフォーマンス問題。
    - Mitigation: スキーマで定義済みのインデックスを活用し、必要に応じて `EXPLAIN` を用いてクエリパフォーマンスを分析します。
- Risk 2: 関数名や構造の不整合。
    - Mitigation: `verbNounByProperty` のような明確な命名規則に従い、一貫した関数シグネチャのパターンを維持します。

## 7. Out of Scope

- データベーススキーマ自体の作成または変更。
- これらのDB関数を使用するAPIエンドポイントの実装。
- このフェーズでのDB関数に対する単体テストまたは統合テストの作成（ただし、後続タスクとして推奨）。
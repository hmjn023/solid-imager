# Track Specification: Tauri Infrastructure & Monorepo Migration (Phase 1-3)

## 1. Overview

現在の SolidStart 版 `solid-imager` を、将来的な Tauri クライアント対応を見据えたアーキテクチャへと移行するための第一段階です。主にドメインロジックの分離、Node.js 依存の抽象化、および物理的なモノレポ構造への再配置を実施します。

## 2. Functional Requirements

- **Phase 1: Coreパッケージの抽出**
  - `src/domain` 配下のエンティティ、Zod スキーマを `packages/core` へ移動し、Node.js 依存を排除する。
- **Phase 2: 抽象化レイヤーの導入**
  - `IFileSystem`, `IMediaStorage`, `IConfigService` などのインターフェースを定義し、インフラ層の Node.js 固有 API（`node:fs`, `sharp`, `fluent-ffmpeg` 等）への直接依存を隠蔽する。
  - 既存のテストコードをリファクタリングし、これらのインターフェース経由で動作するように修正する。
- **Phase 3: モノレポ構成への移行**
  - Bun Workspaces を利用し、以下の構造へプロジェクトを再編する。
    - `apps/server`: 既存のバックエンドロジック、Node.js API 実装。
    - `packages/core`: 環境に依存しない共有ロジック、スキーマ、インターフェース。
  - インポートパスの一括置換および `package.json` の適切な分割を行う。
- **Phase 4: ドキュメントの刷新**
  - `AGENTS.md` および `docs/` 配下の全ドキュメントを、新しい構造とルールに合わせて更新する。

## 3. Non-Functional Requirements

- **保守性**: クリーンアーキテクチャに基づき、ビジネスロジックとインフラ実装を明確に分離する。
- **テスト**: 既存のユニットテストをすべてパスさせ、カバレッジを維持する。
- **ビルド**: Bun Workspaces 環境下で、全てのパッケージが正しくビルド・実行できること。

## 4. Acceptance Criteria

- [ ] `packages/core` が作成され、ドメインロジックが移動されている。
- [ ] `IFileSystem` 等の抽象化インターフェースが導入され、既存の具象実装がそれを継承している。
- [ ] 既存のテストがすべて修正され、パスしている。
- [ ] プロジェクトが `apps/server` と `packages/core` のモノレポ構造に分割されている。
- [ ] インポートパス（`@/` エイリアス等）が新しいモノレポ構造に合わせて正しく動作している。
- [ ] **AGENTS.md および docs/ 配下のドキュメントが、新しいディレクトリ構造とアーキテクチャに合わせて更新されている。**

## 5. Out of Scope

- Phase 4 以降の Tauri クライアントの具体的な実装。
- PGlite の導入（本トラックでは PostgreSQL 依存のままとする）。
- 新機能の追加。

# 設計ドキュメント

このディレクトリには、solid-imager の設計情報が格納されています。

## 📂 ドキュメント一覧

### 概要・要件
- **[overview.md](./overview.md)** - プロジェクトの概要と用語の定義
- **[system-requirements.md](./system-requirements.md)** - システムの要件

### 技術・アーキテクチャ
- **[technology-stack.md](./technology-stack.md)** - 使用されている技術スタック
- **[database-design.md](./database-design.md)** - データベースの設計
- **[api-design.md](./api-design.md)** - API の設計

### 実装ガイド
- **[orpc-guide.md](./orpc-guide.md)** - oRPC による型安全な API 実装ガイド
- **[python-ai-service.md](./python-ai-service.md)** - Python AI サービスの詳細
- **[browser-extension.md](./browser-extension.md)** - ブラウザ拡張機能 (xtracter)

### UI・パフォーマンス
- **[frontend.md](./frontend.md)** - フロントエンドの設計
- **[performance-optimization.md](./performance-optimization.md)** - パフォーマンス最適化

## 🚀 開発を始める

1. まず [AGENTS.md](../../AGENTS.md) を読んで開発フローを理解する
2. [technology-stack.md](./technology-stack.md) で使用技術を確認
3. [orpc-guide.md](./orpc-guide.md) で API 実装方法を学ぶ
4. [database-design.md](./database-design.md) でデータ構造を理解

## 📚 アーキテクチャドキュメント

より詳細なアーキテクチャ情報は [../architecture/](../architecture/) を参照してください。

- **[ARCHITECTURE.md](../architecture/ARCHITECTURE.md)** - クリーンアーキテクチャの実装詳細
- **[ADR-001](../architecture/ADR-001-clean-architecture.md)** - クリーンアーキテクチャ採用の経緯
- **[ADR-002](../architecture/ADR-002-database-schema-consistency.md)** - DB スキーマ一貫性の方針
- **[ADR-003](../architecture/ADR-003-feature-requirements-and-schema-extensions.md)** - 機能要件とスキーマ拡張

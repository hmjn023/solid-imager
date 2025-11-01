# Tasks: DB Pglite切り替え機能

**Branch**: `001-pglite-db-switch` | **Date**: 2025年11月1日土曜日 | **Spec**: /home/hmjn/project/web/solid-imager/specs/001-pglite-db-switch/spec.md

## Summary

このドキュメントは、DB Pglite切り替え機能の実装に必要なタスクを定義します。タスクは依存関係に基づいて順序付けされており、並行して実行可能なタスクには `[P]` マークが付いています。

## Task List

### Setup Tasks

- **T001**: プロジェクトの憲法を定義する。
    - **Description**: `constitution.md` テンプレートを埋め、プロジェクトのコア原則、制約、ワークフローを明確にする。
    - **File**: `.specify/memory/constitution.md`
    - **Dependencies**: なし

- **T002**: pgliteとその依存関係をインストールする。
    - **Description**: pgliteをプロジェクトに統合するために必要なライブラリやツールをインストールする。
    - **File**: `package.json` (または関連する設定ファイル)
    - **Dependencies**: T001

### Core Tasks

- **T003**: 専用の設定ファイルからデータベース設定をロードする機能を実装する。
    - **Description**: `data-model.md` に定義された構造に従って、専用の設定ファイル（例: `db.config.json`）を読み込むロジックを実装する。
    - **File**: `src/config/database.ts` (仮)
    - **Dependencies**: T002

- **T004**: 設定に基づいてpgliteとDocker Compose PostgreSQLを切り替えるデータベース接続ロジックを実装する。
    - **Description**: ロードされた設定タイプに応じて、Drizzle ORMと`postgres`を使用してpgliteまたはDocker Compose PostgreSQLへの接続を確立する。
    - **File**: `src/db/connection.ts` (仮)
    - **Dependencies**: T003

- **T005**: pgliteのデータ永続性と機能パリティがDocker Compose PostgreSQLと同等であることを保証する。
    - **Description**: pgliteがDocker Compose PostgreSQLと同じスキーマ、データ型、および主要なSQL機能（例: トランザクション、インデックス）をサポートし、データが適切に永続化されることを確認する。
    - **File**: `src/db/pglite_adapter.ts` (仮)
    - **Dependencies**: T004

### Test Tasks

- **T006 [P]**: 設定ファイルのロードに関する単体テストを作成する。
    - **Description**: `T003`で実装された設定ロードロジックが正しく機能することを確認する単体テストを作成する。
    - **File**: `tests/unit/config/database.test.ts` (仮)
    - **Dependencies**: T003

- **T007 [P]**: データベース接続切り替えに関する単体テストを作成する。
    - **Description**: `T004`で実装されたデータベース接続切り替えロジックが正しく機能することを確認する単体テストを作成する。
    - **File**: `tests/unit/db/connection.test.ts` (仮)
    - **Dependencies**: T004

- **T008 [P]**: pgliteのデータ永続性と機能パリティに関する統合テストを作成する。
    - **Description**: `T005`の要件を満たしていることを確認するために、pgliteとDocker Compose PostgreSQL間でデータ操作の動作が同等であることを検証する統合テストを作成する。
    - **File**: `tests/integration/db/pglite_parity.test.ts` (仮)
    - **Dependencies**: T005

- **T009 [P]**: pgliteとDocker Compose PostgreSQL間の切り替えに関する統合テストを作成する。
    - **Description**: アプリケーションが設定変更後に正しくデータベースを切り替えることを検証する統合テストを作成する。
    - **File**: `tests/integration/db/switching.test.ts` (仮)
    - **Dependencies**: T004

- **T010 [P]**: エッジケース（無効なDBタイプ、依存関係不足、Docker未起動）に関する統合テストを作成する。
    - **Description**: `T012`で実装されるエラーハンドリングが、定義されたエッジケースに対して正しく機能することを確認する統合テストを作成する。
    - **File**: `tests/integration/error_handling.test.ts` (仮)
    - **Dependencies**: T012

### Integration Tasks

- **T011**: データベース切り替えロジックをアプリケーションの起動プロセスに統合する。
    - **Description**: アプリケーションの起動時に、設定ファイルからデータベースタイプを読み込み、適切なデータベース接続を初期化するようにアプリケーションを修正する。
    - **File**: `src/app.ts` (またはエントリポイントファイル)
    - **Dependencies**: T004

- **T012**: データベース接続失敗時のエラーハンドリングを実装し、一般的なエラーメッセージを表示する。
    - **Description**: データベース接続が失敗した場合に、アプリケーションが起動を停止し、一般的なエラーメッセージをユーザーに表示するロジックを実装する。
    - **File**: `src/utils/error_handler.ts` (仮)
    - **Dependencies**: T011

### Polish Tasks

- **T013**: DB切り替えに関するドキュメント（例: `README.md`）を更新する。
    - **Description**: 開発者がDB切り替え機能を簡単に利用できるように、設定方法や注意点などを`README.md`に追記する。
    - **File**: `README.md`
    - **Dependencies**: T011, T012

## Parallel Execution Example

```bash
# Phase 1: Setup and Core Implementation (Sequential)
/speckit.tasks T001
/speckit.tasks T002
/speckit.tasks T003
/speckit.tasks T004
/speckit.tasks T005

# Phase 2: Test Implementation (Parallel)
/speckit.tasks T006 & /speckit.tasks T007 & /speckit.tasks T008 & /speckit.tasks T009 & /speckit.tasks T010

# Phase 3: Integration and Polish (Sequential)
/speckit.tasks T011
/speckit.tasks T012
/speckit.tasks T013
```

# AI Tagging Enhancement Design (v2)

## 1. 要件定義

本機能強化の目的は、AIタギングの効率化、自動化、および永続化によるUX向上である。

### 1.1 機能要件
1.  **推論結果の永続化 (Cache & Persist)**
    -   AIによる推論結果（タグ、キャラクター、IP）をデータベースに保存する。
    -   一度推論したメディアに対しては、画像の変更がない限り、再推論を行わずにDBの保存結果を返す。
    -   データの起源 (`source`) を明確に区別する（例: `source='AI'`）。

2.  **自動タギング (Auto-Tagging on Import)**
    -   新規メディア追加時（アップロード、インポート、監視ディレクトリ検知）に、バックグラウンドで自動的にAIタギングを実行する。
    -   ユーザーの操作をブロックしないよう、非同期ジョブとして処理する。

3.  **バッチ処理 (Batch Processing)**
    -   既存の未タグ付けメディアに対して、一括でAIタギングを行う機能を提供する。
    -   大量のメディアに対しても安定して動作するよう、ジョブキューを用いた順次処理を行う。

4.  **フロントエンド最適化 (TanStack Query)**
    -   フロントエンドでのデータ取得に `TanStack Query` を導入する。
    -   適切なキャッシュ戦略（`staleTime: Infinity` 等）を用い、無駄なAPIリクエストを削減する。

### 1.2 非機能要件
-   **パフォーマンス**: 推論済みのデータ取得はDB参照のみとし、100ms以内を目指す。
-   **信頼性**: 推論エラー時もシステム全体を停止させず、エラーをログに残してスキップまたは再試行可能にする。
-   **整合性**: メディアファイルが変更（上書き等）された場合、既存のAIタグは無効化（または再推論）されるべきである。

## 2. データベース設計

既存のスキーマを利用するが、`confidence` (信頼度) の扱いを明確化する。

-   **Tags (`media_tags`)**
    -   `source`: `'AI'`
    -   `confidence`: AIの確信度スコア (0.0 - 1.0) を保存。
-   **Characters (`media_characters`)**
    -   `source`: `'AI'`
    -   `confidence`: 同上。
-   **IPs (`media_ips`)**
    -   `source`: `'AI'`
    -   `confidence`: 同上。

**Schema Fix Required**:
-   `media_ips` テーブルに `confidence` カラムが存在しないため、スキーママイグレーションを実施し追加する（**必須**）。
-   Repository層で `confidence` を正しく読み書きできるよう修正する。

## 3. バックエンド設計

### 3.1 TaggingService (Core Logic)
`getTagsForMedia` メソッドを **Cache-aside** パターンにリファクタリングする。

**処理フロー**:
1.  **キャッシュ確認**:
    -   DBの `media_tags`, `media_characters`, `media_ips` を検索。
    -   `source = 'AI'` のデータが存在するか確認。
2.  **キャッシュヒット (DBにデータあり)**:
    -   DBデータを `TaggingResponse` 形式に整形して返却。
    -   **注意**: 完全に元のAIレスポンスJSONを復元するのは難しいため、主要なタグ・キャラ・IP情報を含んだ形式とする。
3.  **キャッシュミス (DBにデータなし)**:
    -   Python AI Service へ推論リクエスト (`/tag`)。
    -   レスポンスを `saveTags` メソッドでDBに保存。
        -   **Tags**: `TagRepository.upsert` (source='AI', confidence=score)
        -   **Characters**: `CharacterRepository.findOrCreate` -> `linkToMedia`
        -   **IPs**: `IpRepository.findOrCreate` -> `linkToMedia`
    -   推論結果を返却。

### 3.2 Job System
新しいジョブタイプ `auto_tagging` および `bulk_tagging_dispatch` を定義する。

-   **Job Definition**:
    -   Type: `auto_tagging`
    -   Payload: `{ mediaId: string, mediaSourceId: string, force?: boolean }`
    -   **用途**: バッチ処理、またはユーザーによる手動再解析用。
        -   ※新規メディア追加（インポート）時は、`processMedia` ジョブ内部で処理を行うため、このジョブは発行されない。
    -   Type: `bulk_tagging_dispatch`
    -   Payload: `{ force?: boolean, batchSize?: number }`
-   **Worker Behavior**:
    -   `auto_tagging`: `TaggingService.getTagsForMedia` を呼び出す。
    -   `bulk_tagging_dispatch`: 対象メディアを検索し、`auto_tagging` ジョブを一括登録する。

### 3.3 Media Processing Workflow
`processMedia` ジョブの既存の実装（現在はプレースホルダーとなっている `Step 3: AI tagging`）を有効化し、実装する。

```typescript
// in MediaProcessingService.executeProcessMediaJob

// Step 3: AI tagging
// 現在は定数で無効化されているロジックを有効化し、TaggingServiceを呼び出す
if (this.enableAutoTagging && !payload?.skipMetadataExtraction) {
  try {
     // 新規ジョブを発行するのではなく、ここで直接実行する
     await this.taggingService.getTagsForMedia(mediaSourceId, mediaId);
  } catch (e) {
    logger.warn({ err: e, mediaId }, "AI tagging failed, skipping");
  }
}
```

## 4. フロントエンド設計

### 4.1 Data Fetching (TanStack Query)
`@orpc/tanstack-query` (または `solid-query`) を導入し、データ取得を宣言的に記述する。

-   **Hook**: `createTagsQuery(mediaSourceId, mediaId)`
-   **Options**:
    -   `staleTime`: `Infinity` (画像が変わらない限りデータは新鮮とみなす)
    -   `enabled`: モーダルが開いている時、または詳細画面が表示されている時。

### 4.2 UI Component (`AiTaggingModal`)
-   **State Management**: ローカルの `isLoading` stateを廃止し、Queryの `status` (`pending`, `success`, `error`) を利用。
-   **Re-analyze Action**:
    -   「再解析」ボタン押下時に、API endpoint (e.g., `POST /api/rpc/ai/retag`) を叩く。
    -   成功後、Query Client の `invalidateQueries` を呼び出し、データを最新化する。

## 5. バッチ処理設計

システム管理画面 (`Manager`) に「全メディアのAI解析を実行」ボタンを設置する機能。

### 5.1 Batch API Endpoint
`POST /api/rpc/ai/batch-tagging`

-   **Logic**:
    1.  APIリクエストを受け取ったら、即座に `bulk_tagging_dispatch` ジョブを作成・キューイングする。
    2.  HTTPレスポンスとしては「バッチ処理を開始しました」と即座に返す（タイムアウト回避）。

### 5.2 Dispatcher Job Logic (`bulk_tagging_dispatch`)
-   **Logic**:
    1.  DBから対象メディア（`media_type = 'image'` かつ AIタグ未付与）を検索する。
    2.  大量データを考慮し、**カーソルベースのページネーション**（またはチャンク処理）を用いて一定件数（例: 1000件）ずつIDを取得する。
    3.  取得したIDごとに `auto_tagging` ジョブを作成・キューイングする。
    4.  メモリ圧迫を防ぐため、全件IDの一括ロードは避ける。

## 6. 実装フェーズ

### Phase 1: Core & Repository
1.  DBスキーマ確認 (`media_tags` の `confidence` 読み書き確認)。
2.  `TagRepository`, `CharacterRepository` に `source` と `confidence` を扱うメソッドを追加・改修。
3.  `TaggingService` に `saveTags` とキャッシュロジックを実装。

### Phase 2: Async & Batch
1.  `auto_tagging` ジョブの実装とWorkerへの登録。
2.  `MediaProcessingService` からのジョブ発行連携。
3.  Batch APIの実装。

### Phase 3: Frontend
1.  TanStack Queryのセットアップ。
2.  `AiTaggingModal` のリファクタリング。

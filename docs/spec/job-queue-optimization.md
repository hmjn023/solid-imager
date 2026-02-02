# Job Queue Persistence Optimization & Recovery Strategy

## 1. 概要と目的

### 背景
現在、`jobs` テーブルを使用したジョブキューの管理を行っているが、PostgreSQLの仕様上、ステータス更新（pending -> processing -> completed）のたびにWAL（Write Ahead Log）への書き込みが発生する。
特にローカル環境や `pglite` を使用する場合、また大量のメディアを一括処理する場合において、この頻繁なディスク書き込みはSSDの寿命（TBW: Terabytes Written）を不必要に消費する懸念がある。

### 目的
1.  **ディスクI/Oの削減**: `jobs` テーブルへの書き込み負荷を最小限に抑える。
2.  **耐障害性の確保**: プロセス終了やクラッシュによってジョブデータが消失しても、アプリケーション起動時に自動的に未処理タスクを復元（再発行）できる仕組みを構築する。

## 2. アーキテクチャ変更

### 2.1 `UNLOGGED` テーブルの採用

PostgreSQLの `UNLOGGED` テーブル機能を利用する。これにより、対象テーブルへの操作はWALに記録されなくなり、ディスクI/Oが劇的に減少する。
トレードオフとして、クラッシュ時にテーブルの内容は消失（または空）になるが、後述のリカバリ戦略によりこれを許容する。

**スキーマ変更:**
Drizzle ORMの定義は変更せず、マイグレーションSQLにおいて `jobs` テーブルの作成定義を `CREATE UNLOGGED TABLE` に変更する。

```sql
-- migration.sql
CREATE UNLOGGED TABLE IF NOT EXISTS "jobs" (
  -- ... columns ...
);
```

## 3. リカバリ戦略 (Startup Recovery)

ジョブデータが消失してもシステムの整合性を保つため、アプリケーション起動時に「あるべき状態（処理完了）」と「現在の状態」の差分を検出し、必要なジョブを自動的に再発行する **Startup Recovery** 機構を実装する。

### 3.1 新規サービス: `MaintenanceService`

データの整合性チェックと修復を行う専用サービス `MaintenanceService` を `apps/server/src/application/services/maintenance-service.ts` に実装する。

#### 機能要件

1.  **サムネイル欠損検知 (`queueMissingThumbnails`)**
    *   **ロジック**: 全メディアをスキャンし、ディスク上にサムネイルファイルが存在しないレコードを特定する。
    *   **アクション**: 対象メディアに対して `processMedia` ジョブ（サムネイル生成を含む）を発行する。
    *   **最適化**: ファイルシステムへのアクセスはコストが高いため、バッチ処理や非同期イテレータを用いてメインスレッドをブロックしないように実装する。

2.  **メタデータ欠損検知 (`queueMissingMetadata`)**
    *   **ロジック**: `media_technical_info` や `media_generation_info` が紐付いていない、または必須カラムが空のメディアレコードをクエリで抽出する。
    *   **アクション**: 対象メディアに対して `processMedia` ジョブ（メタデータ抽出を含む）を発行する。

### 3.2 実行タイミング

`apps/server/src/infrastructure/bootstrap.ts` の起動プロセス内、DB接続確立後かつジョブワーカー開始前に `MaintenanceService.performStartupChecks()` を実行する。

```typescript
// bootstrap.ts concept
await db.connect();
await jobWorker.start();

// バックグラウンドでリカバリタスクを開始（起動を遅延させない）
MaintenanceService.performStartupChecks().catch(err => {
  logger.error({ err }, "Startup recovery failed");
});
```

## 4. 実装詳細

### 4.1 MaintenanceService インターフェース

```typescript
export class MaintenanceService {
  /**
   * 起動時の整合性チェックと修復ジョブの発行を行う
   */
  async performStartupChecks(): Promise<void> {
    logger.info("Starting startup checks...");
    await this.queueMissingMetadata();
    await this.queueMissingThumbnails();
    logger.info("Startup checks completed.");
  }

  private async queueMissingMetadata() {
    // SQL: SELECT id FROM media 
    //      LEFT JOIN media_generation_info ON ... 
    //      WHERE media_generation_info.id IS NULL
    // ...
  }

  private async queueMissingThumbnails() {
    // Iterate media and check fs.exists(thumbnailPath)
    // ...
  }
}
```

### 4.2 ジョブ発行の重複排除

リカバリ処理によって大量のジョブが発行される可能性があるため、`JobRepository` 側で「同種のPendingジョブが既に存在する場合は作成しない」という重複排除ロジック（`deduplicate`）が有効に機能することを確認する。

## 5. 移行手順

1.  **マイグレーション作成**:
    *   `drizzle-kit generate` を実行。
    *   生成されたSQLを手動修正し、`CREATE TABLE "jobs"` を `CREATE UNLOGGED TABLE "jobs"` に書き換える。既存テーブルがある場合は `ALTER TABLE "jobs" SET UNLOGGED` を追加する。
2.  **サービス実装**: `MaintenanceService` を実装。
3.  **組み込み**: `bootstrap.ts` に呼び出し処理を追加。
4.  **検証**:
    *   サーバーを強制終了し、ジョブデータを消失させる。
    *   再起動後、未処理だったメディアの処理が自動的に再開（再キューイング）されることを確認する。

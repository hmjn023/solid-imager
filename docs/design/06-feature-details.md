# 機能詳細仕様
### 2. メディア配信・サムネイル作成機能
#### メディア配信
- **エンドポイント**: `GET /api/sources/:sourceId/media/[...filePath]`
- **処理**:
    1. `sourceId`と`filePath`を基に、データベースからメディアソースの情報を取得します。
    2. メディアソースの種類に応じたストレージドライバー（`local`, `sftp`など）を取得します。
    3. ドライバーを用いて、指定された`filePath`からファイル内容を読み込みます。
    4. ファイル内容を適切な`Content-Type`ヘッダーと共にレスポンスとして返します。
- **API関数**: `MediaService.getMediaContent(sourceId: string, mediaId: string)`

#### サムネイル仕様
- サイズ: クエリパラメータで指定 (?size=200, ?size=400等)
- キャッシュ: ローカルディスクにキャッシュ保存
- 対応形式: PNG, JPEG, WebP
- 生成: バックグラウンド生成（ジョブキュー）

#### サムネイル生成タイミング
- メディアソース追加時: 既存メディアの一括生成開始
- SSEで新メディア検知時: 個別メディアの生成開始
- 手動トリガー: 再生成API提供

#### 進捗通知（SSE）
```typescript
export type ThumbnailProgress = {
  type: "thumbnail_progress";
  sourceId: string;
  status: "started" | "processing" | "completed" | "error";
  progress: {
    current: number;
    total: number;
    currentFile?: string;
  };
  error?: string;
};

```

### 3. メディアメタデータ抽出機能
#### データ構造
```typescript
export type MediaMetadata = {
  prompt?: object;
  workflow?: object;
  parameters?: string;
  extractedTags?: string[]; // Add extracted tags
  [key: string]: unknown;
};
```

#### 処理仕様
1. PNGメディアからtEXtチャンクを読み取り
2. `prompt`, `workflow`キーはJSON解析を試行
3. 解析失敗時はテキストとして保持
4. その他キーはテキストのまま
5. メタデータが存在しない場合は空オブジェクト返却

#### タグ抽出
ワークフローデータ（特にComfyUIのワークフローJSON）から、特定のノードや設定に基づいてタグを自動的に抽出します。抽出されたタグは `MediaMetadata.extractedTags` に保存されます。

### 4. SSE機能
#### 対象範囲
- `type: 'local'` のメディアソースのみ対応
- SFTP/S3は非対応

#### データ構造
```typescript
export type FileSystemEvent = {
  type: "added" | "deleted" | "modified";
  sourceId: string;
  filePath: string;
  timestamp: Date;
};
```

#### 監視仕様
- ライブラリ: chokidar でファイルシステム監視
- 対象: メディアファイル（.png, .jpg, .jpeg, .webp等）
- 範囲: サブディレクトリも再帰的に監視
- エラー: 非localソースは "ローカルファイルソースのみ対応" エラー

### 5. メディアアップロード機能
#### リクエストフォーマット (multipart/form-data)
```typescript
export type UploadRequest = {
  file: File;
  filename?: string;
  autoIncrement?: boolean;
  description?: string;
  sourceUrl?: string;
  overwrite?: boolean;
};
```

#### 対応状況
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### ファイル名処理
- カスタム名優先、未指定時は元ファイル名使用
- `autoIncrement: true` 時は `media_001.png`, `media_002.png` 形式
- 重複時は `conflict` 情報を返してユーザー確認要求

### 6. 設定管理機能
#### 設定構造
```typescript
export type AppConfig = {
  server?: {
    port?: number;
    host?: string;
  };
  media?: {
    supportedFormats?: string[];
    thumbnailSizes?: number[];
    cacheDirectory?: string;
    autoGenerate?: boolean;
    maxConcurrentJobs?: number;
  };
  upload?: {
    maxFileSize?: number;
    allowOverwrite?: boolean;
  };
  [key: string]: unknown;
};
```

#### ファイル保存
- 保存場所: プロジェクトルート `config.json`
- フォーマット: JSON形式
- 自動バックアップ: 更新時に `config.json.backup` 作成

### 7. メディアソート・検索機能
#### ソート条件
```typescript
interface SortOptions {
  field: 'name' | 'createdAt' | 'modifiedAt' | 'fileSize';
  order: 'asc' | 'desc';
}
```

#### 検索条件
```typescript
export type SearchOptions = {
  tags?: string[];
  filename?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  // Add other search parameters as needed, e.g., for metadata
  [key: string]: unknown;
};

```

#### 実装方
- **Phase 1**: ファイルシステムベース（都度メタデータ読み取り）
- **Phase 2**: DB対応でパフォーマンス改善予定
- ページネーション対応（デフォルト50件）
- タグ検索は AND 条件で実装

### 8. メディア情報編集機能
#### リクエストフォーマット
```typescript
export type MediaUpdateData = {
  filename?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[]; // Assuming tags are passed as string names for update
};
```

#### ファイル名変更仕様
- 実際のファイルシステムでもリネーム実行
- 重複時はエラーまたは自動リネーム
- DBのfile_pathとfile_nameを更新
- サムネイルキャッシュは既存のまま保持

#### タグ処理
- 新しいタグは自動でtagsテーブルに作成
- media_tagsテーブルは完全置換（既存削除→新規追加）
- タグの付与方法（source）も同時に管理され、手動付与の場合は 'manual' がデフォルト値となる。

### 9. **ディレクトリ管理機能**
#### 対応範囲
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### リクエストフォーマット
```typescript
export type CreateDirectoryRequest = {
  path: string;
  name: string;
  recursive?: boolean;
};

export type UpdateDirectoryRequest = {
  oldPath: string;
  newPath: string;
};

export type DeleteDirectoryRequest = {
  path: string;
  force?: boolean;
};
```

#### 削除処理詳細
1. 空でないディレクトリは `force: true` 必須
2. 削除対象メディアをDBから検索・削除
3. サムネイルキャッシュも連動クリーンアップ
4. 実際のディレクトリ削除実行
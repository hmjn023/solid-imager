
# 機能詳細仕様

### 2. メディア配信・サムネイル作成機能

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
interface ThumbnailProgress {
  type: 'thumbnail_progress';
  sourceId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
  progress: {
    current: number;    // 処理済みメディア数
    total: number;      // 総メディア数
    currentFile?: string;
  };
  error?: string;
}
```

### 3. メディアメタデータ抽出機能

#### データ構造
```typescript
interface MediaMetadata {
  // ComfyUI標準フィールド（JSON解析）
  prompt?: object;     // JSON.parse(textChunk["prompt"])
  workflow?: object;   // JSON.parse(textChunk["workflow"])
  
  // その他のキー（テキストのまま）
  parameters?: string;
  [key: string]: any;  // 将来的な拡張用
}
```

#### 処理仕様
1. PNGメディアからtEXtチャンクを読み取り
2. `prompt`, `workflow`キーはJSON解析を試行
3. 解析失敗時はテキストとして保持
4. その他キーはテキストのまま
5. メタデータが存在しない場合は空オブジェクト返却

### 4. SSE機能

#### 対象範囲
- `type: 'local'` のメディアソースのみ対応
- SFTP/S3は非対応

#### データ構造
```typescript
interface FileSystemEvent {
  type: 'added' | 'deleted' | 'modified';
  sourceId: string;
  filePath: string;    // 相対パス
  timestamp: Date;
}
```

#### 監視仕様
- ライブラリ: chokidar でファイルシステム監視
- 対象: メディアファイル（.png, .jpg, .jpeg, .webp等）
- 範囲: サブディレクトリも再帰的に監視
- エラー: 非localソースは "ローカルファイルソースのみ対応" エラー

### 5. メディアアップロード機能

#### リクエスト形式（multipart/form-data）
```typescript
interface UploadRequest {
  file: File;                    // アップロードファイル
  filename?: string;             // カスタムファイル名
  autoIncrement?: boolean;       // 自動インクリメント有効化
  description?: string;          // メディア説明
  sourceUrl?: string;            // 取得元リンク
  overwrite?: boolean;           // 上書き許可
}
```

#### レスポンス形式
```typescript
interface UploadResponse {
  success: boolean;
  filePath: string;              // 保存されたパス
  conflict?: {                   // 重複時
    existingFile: string;
    suggestedName: string;
  }
}
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
interface AppConfig {
  // サーバー設定
  server?: {
    port?: number;
    host?: string;
  };
  
  // メディア処理設定
  media?: {
    supportedFormats?: string[];     // ['png', 'jpg', 'jpeg', 'webp'] (将来: 動画・音声も)
    thumbnailSizes?: number[];       // [200, 400, 800]
    cacheDirectory?: string;
    autoGenerate?: boolean;          // ソース追加時の自動生成
    maxConcurrentJobs?: number;      // 同時生成数制限
    // 将来拡張: videoThumbnailTime?, audioWaveform? 等
  };
  
  // アップロード設定
  upload?: {
    maxFileSize?: number;           // バイト数
    allowOverwrite?: boolean;
  };
  
  // 拡張用
  [key: string]: any;
}
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
interface SearchOptions {
  tags?: string[];        // タグ検索（AND/OR）
  filename?: string;      // ファイル名部分一致
  dateRange?: {          // 日付範囲
    from?: Date;
    to?: Date;
  };
}
```

#### 実装方針
- **Phase 1**: ファイルシステムベース（都度メタデータ読み取り）
- **Phase 2**: DB対応でパフォーマンス改善予定
- ページネーション対応（デフォルト50件）
- タグ検索は AND 条件で実装

### 8. メディア情報編集機能

#### リクエスト形式
```typescript
interface UpdateMediaRequest {
  filename?: string;        // ファイル名変更（実ファイルもリネーム）
  description?: string;     // メディア説明
  sourceUrl?: string;       // 取得元リンク
  tags?: string[];         // タグ配列（完全置換）
}
```

#### レスポンス形式
```typescript
interface UpdateMediaResponse {
  success: boolean;
  updatedFields: string[];  // 変更されたフィールド一覧
  oldFilePath?: string;     // ファイル名変更時の旧パス
  newFilePath?: string;     // ファイル名変更時の新パス
  warnings?: string[];      // 重複等の注意事項
}
```

#### ファイル名変更仕様
- 実際のファイルシステムでもリネーム実行
- 重複時はエラーまたは自動リネーム
- DBのfile_pathとfile_nameを更新
- サムネイルキャッシュは既存のまま保持

#### タグ処理
- 新しいタグは自動でtagsテーブルに作成
- media_tagsテーブルは完全置換（既存削除→新規追加）

### 9. ディレクトリ管理機能

#### 対応範囲
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### 作成機能
```typescript
interface CreateDirectoryRequest {
  name: string;          // 作成するディレクトリ名
  recursive?: boolean;   // 親ディレクトリも作成
}

interface CreateDirectoryResponse {
  success: boolean;
  fullPath: string;      // 作成されたフルパス
  created: string[];     // 実際に作成されたディレクトリ一覧
}
```

#### 削除機能
```typescript
interface DeleteDirectoryRequest {
  force?: boolean;       // 空でなくても削除
}

interface DeleteDirectoryResponse {
  success: boolean;
  deletedFiles?: number; // 削除されたメディア数
  warnings?: string[];   // 警告メッセージ
}
```

#### 削除処理詳細
1. 空でないディレクトリは `force: true` 必須
2. 削除対象メディアをDBから検索・削除
3. サムネイルキャッシュも連動クリーンアップ
4. 実際のディレクトリ削除実行

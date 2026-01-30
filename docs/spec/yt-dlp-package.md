# yt-dlp / FFmpeg パッケージ化計画

## 概要
現在、システムの `yt-dlp` および `ffmpeg` バイナリに依存している動画ダウンロード処理を、Node.js パッケージ (`npm`) 管理下のバイナリに移行する。
これにより、開発環境および本番環境（Dockerコンテナ等）におけるシステム依存を排除し、ポータビリティとセットアップの容易性を向上させる。

## 選定パッケージ

### 1. yt-dlp ラッパー: `youtube-dl-exec`
*   **パッケージ名**: `youtube-dl-exec`
*   **理由**:
    *   Node.js コミュニティで最も広く利用されている `yt-dlp` ラッパーの一つ。
    *   型定義 (TypeScript) が提供されている。
    *   `yt-dlp` バイナリの自動ダウンロード・管理機能を持つ。
    *   活発にメンテナンスされている。

### 2. FFmpeg バイナリ: `ffmpeg-static`
*   **パッケージ名**: `ffmpeg-static`
*   **理由**:
    *   主要なOS (Linux, macOS, Windows) 向けの静的リンクされた `ffmpeg` バイナリを提供する。
    *   `npm install` だけでバイナリが配置され、パス解決が容易。
    *   `yt-dlp` は動画・音声の結合やフォーマット変換に `ffmpeg` を必要とするため、これもパッケージ化することで完全なポータビリティを実現する。
*   **注意**: パッケージサイズは約70MB程度、Dockerイメージサイズへの影響を考慮すること。

## 現在の実装

### 対象ファイル
- `src/infrastructure/jobs/download-jobs.ts`

### 現在使用している yt-dlp オプション

#### `downloadWithYtDlp` 関数 (ダウンロード用)
| 現在のオプション | 説明 |
|---|---|
| `--no-simulate` | 実際にダウンロードを実行 |
| `--print-json` | メタデータをJSON形式で出力 |
| `--paths <outputDir>` | 出力ディレクトリを指定 |
| `-o %(id)s.%(ext)s` | 出力ファイル名テンプレート |
| `--user-agent <userAgent>` | User-Agentヘッダー（条件付き） |
| `--cookies <cookieFilePath>` | Cookieファイルパス（条件付き） |

#### `fetchMetadataWithYtDlp` 関数 (メタデータ取得用)
| 現在のオプション | 説明 |
|---|---|
| `--simulate` | ダウンロードせずシミュレート |
| `--print-json` | メタデータをJSON形式で出力 |
| `--user-agent <userAgent>` | User-Agentヘッダー（条件付き） |
| `--cookies <cookieFilePath>` | Cookieファイルパス（条件付き） |

## 実装設計

### インストール
```bash
bun add youtube-dl-exec ffmpeg-static
bun add -D @types/ffmpeg-static
```

### コード変更方針 (`src/infrastructure/jobs/download-jobs.ts`)

現在の `child_process.execFileAsync` を使用した直接実行から、ライブラリ経由の実行に変更する。

```typescript
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';

// ffmpeg-static は string | null を返すため、null チェックが必要
if (!ffmpegPath) {
  throw new Error('ffmpeg-static binary not found');
}

/**
 * Downloads video/media using yt-dlp (新実装)
 */
async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  cookies?: Cookie[],
  userAgent?: string
): Promise<{ filePath: string; metadata: YtDlpOutput }[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const template = "%(id)s.%(ext)s";
  
  const cookieFilePath = await createNetscapeCookieFile(cookies || []);
  
  try {
    // youtube-dl-exec は Promise を返し、結果を直接取得できる
    const result = await youtubedl(url, {
      noSimulate: true,
      printJson: true,
      paths: outputDir,
      output: template,
      ffmpegLocation: ffmpegPath,
      ...(userAgent && { userAgent }),
      ...(cookieFilePath && { cookies: cookieFilePath }),
    });

    // result は単一オブジェクトまたは配列
    const outputs = Array.isArray(result) ? result : [result];
    
    return outputs.map((data) => {
      let finalPath = data.filename;
      if (!path.isAbsolute(finalPath)) {
        finalPath = path.join(outputDir, finalPath);
      }
      return { filePath: finalPath, metadata: data as YtDlpOutput };
    });
  } catch (error) {
    // youtube-dl-exec のエラーには stderr が含まれる
    if (error instanceof Error && 'stderr' in error) {
      logger.error({ stderr: (error as any).stderr }, "yt-dlp execution failed");
    }
    throw new Error(`yt-dlp failed: ${error}`);
  } finally {
    if (cookieFilePath) {
      fs.unlink(cookieFilePath).catch(() => {});
    }
  }
}

/**
 * Fetches metadata using yt-dlp without downloading (新実装)
 */
async function fetchMetadataWithYtDlp(
  url: string,
  cookies?: Cookie[],
  userAgent?: string
): Promise<YtDlpOutput | null> {
  const cookieFilePath = await createNetscapeCookieFile(cookies || []);

  try {
    const result = await youtubedl(url, {
      dumpSingleJson: true,  // --dump-single-json: メタデータのみ取得
      noDownload: true,
      ffmpegLocation: ffmpegPath,
      ...(userAgent && { userAgent }),
      ...(cookieFilePath && { cookies: cookieFilePath }),
    });

    return result as YtDlpOutput;
  } catch (error) {
    logger.warn({ err: error, url }, "Failed to fetch metadata with yt-dlp");
    return null;
  } finally {
    if (cookieFilePath) {
      fs.unlink(cookieFilePath).catch(() => {});
    }
  }
}
```

### オプションマッピング表

| 現在のCLIオプション | youtube-dl-exec オプション名 | 備考 |
|---|---|---|
| `--no-simulate` | `noSimulate: true` | |
| `--simulate` | (dumpSingleJson使用時は不要) | `dumpSingleJson` は暗黙的にシミュレート |
| `--print-json` | `printJson: true` | ダウンロード時 |
| `-o <template>` | `output: template` | |
| `--paths <dir>` | `paths: outputDir` | |
| `--user-agent <ua>` | `userAgent: ua` | |
| `--cookies <file>` | `cookies: filePath` | |
| `--dump-single-json` | `dumpSingleJson: true` | メタデータ取得時（推奨） |
| `--no-download` | `noDownload: true` | メタデータ取得時 |
| (新規) | `ffmpegLocation: ffmpegPath` | ffmpeg-static のパス |

### Cookie 対応
現在の実装では、Twitter (X) の動画ダウンロード時などにブラウザから取得した Cookie を利用している。
`youtube-dl-exec` も `cookies` オプションをサポートしており、ファイルパスを受け取る仕様となっている。

*   **方針**: 既存の `createNetscapeCookieFile` 関数（JSON形式のCookie配列をNetscape形式の一時ファイルに変換するロジック）を維持し、利用する。
*   **実装**:
    1.  リクエストに含まれるCookie配列を `createNetscapeCookieFile` で一時ファイルに書き出す。
    2.  生成されたファイルパスを `youtube-dl-exec` の `cookies` オプションに渡す。
    3.  処理完了後、一時ファイルを削除する。

## 移行ステップ

### Phase 1: パッケージ追加と基盤整備
1. [ ] `youtube-dl-exec`, `ffmpeg-static`, `@types/ffmpeg-static` をインストール
2. [ ] ffmpegPath の null チェックユーティリティを作成

### Phase 2: コード移行
3. [ ] `downloadWithYtDlp` 関数を書き換え
4. [ ] `fetchMetadataWithYtDlp` 関数を書き換え
5. [ ] バージョン確認ロジック (`yt-dlp --version`) を削除または更新
    *   ライブラリがバイナリを自動管理するため不要になるが、デバッグ用に `youtubedl.getBinaryPath()` でパス確認可能

### Phase 3: 動作検証
6. [ ] Twitter (X) 動画のダウンロードテスト
7. [ ] 直接画像ダウンロード時のメタデータ取得テスト（`fetchMetadataWithYtDlp` 使用箇所）
8. [ ] 結合処理 (Video+Audio) が `ffmpeg-static` を使って正常に行われるか確認

### Phase 4: クリーンアップ
9. [ ] Dockerfile からシステムレベルの `yt-dlp`, `ffmpeg` インストール手順を削除
10. [ ] セットアップドキュメントを更新

## テスト計画

### ユニットテスト
- `youtube-dl-exec` のモック化
  ```typescript
  vi.mock('youtube-dl-exec', () => ({
    default: vi.fn().mockResolvedValue({
      id: 'test-id',
      filename: 'test-id.mp4',
      title: 'Test Video',
      ext: 'mp4',
    }),
  }));
  ```
- `ffmpeg-static` のモック化: 固定パス文字列を返す

### 統合テスト
- 実際のバイナリを使用したダウンロードテスト（手動またはCI/CD）
- Cookie付きリクエストのテスト

## 懸念点と対応

### バイナリダウンロード
`youtube-dl-exec` はインストール時または初回実行時にバイナリをダウンロードするため、外部ネットワーク接続が必要。
*   **対応**: CI/CDやDockerビルドプロセスでネットワークアクセスが可能であることを確認する。
*   **オフライン対応**: 必要に応じて `YOUTUBE_DL_SKIP_DOWNLOAD=true` でスキップし、手動でバイナリを配置することも可能。

### 実行権限
`node_modules` 内のバイナリに実行権限が付与されている必要がある。
*   **対応**: 通常はnpm/bunが処理するが、Docker環境などで問題が出た場合は `chmod +x` 等で対応。

### バージョン固定
動画サイトのAPI変更に対応するため、`yt-dlp` のバージョン管理が重要。
*   **対応**: `youtube-dl-exec` の `YOUTUBE_DL_FILENAME` 環境変数で特定バージョンを指定可能。
*   package.json でライブラリバージョンを固定することで間接的にバイナリバージョンも固定される。

### ロールバック計画
問題発生時のフォールバック対応:
1. パッケージ版が動作しない場合、`YOUTUBE_DL_FILENAME` でシステムバイナリのパスを指定
2. 緊急時は `child_process.execFileAsync` 版のコードにロールバック（git revert）

## エラーハンドリング

### youtube-dl-exec のエラー型
```typescript
interface YtDlpError extends Error {
  stderr: string;    // yt-dlp の標準エラー出力
  exitCode: number;  // 終了コード
}
```

### 再試行ロジック
現在の実装では再試行ロジックは未実装。必要に応じて以下を検討:
- ネットワークエラー時の指数バックオフ再試行
- レートリミット検出時の待機

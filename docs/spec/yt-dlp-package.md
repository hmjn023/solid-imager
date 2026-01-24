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

## 実装設計

### インストール
```bash
bun add youtube-dl-exec ffmpeg-static
```

### コード変更方針 (`src/infrastructure/jobs/download-jobs.ts`)

現在の `child_process.execFileAsync` を使用した直接実行から、ライブラリ経由の実行に変更する。

```typescript
import { create } from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

// youtube-dl-exec のインスタンス作成
// (デフォルトでバイナリを自動管理するが、パスを明示することも可能)
const youtubedl = create(path.resolve('./node_modules/.bin/yt-dlp')); 
// ※ または単にインポートした関数を使用

export const downloadVideo = async (url: string, outputDir: string) => {
  try {
    const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');
    
    await youtubedl(url, {
      output: outputTemplate,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      ffmpegLocation: ffmpegPath, // ffmpeg-static のパスを指定
      noCheckCertificates: true,
      addHeader: [
        'referer:twitter.com',
        'user-agent:Mozilla/5.0 ...' // 必要に応じて設定
      ],
      // 既存のオプションをここにマッピング
    });
    
    // 成功ログ
  } catch (error) {
    // エラーハンドリング
  }
}
```

### Cookie 対応
現在の実装では、Twitter (X) の動画ダウンロード時などにブラウザから取得した Cookie を利用している。
`youtube-dl-exec` も `--cookies` オプションをサポートしており、ファイルパスを受け取る仕様となっている。

*   **方針**: 既存の `createNetscapeCookieFile` 関数（JSON形式のCookie配列をNetscape形式の一時ファイルに変換するロジック）を維持し、利用する。
*   **実装**:
    1.  リクエストに含まれるCookie配列を `createNetscapeCookieFile` で一時ファイルに書き出す。
    2.  生成されたファイルパスを `youtube-dl-exec` の `cookies` オプションに渡す。
    3.  処理完了後、一時ファイルを削除する。

### 移行ステップ
1.  **パッケージ追加**: `youtube-dl-exec`, `ffmpeg-static` をインストール。
2.  **ロジック置換**: `download-jobs.ts` 内の `yt-dlp` 呼び出し箇所を書き換え。
    *   バージョン確認ロジック (`yt-dlp --version`) はライブラリがバイナリ管理するため不要になる可能性があるが、デバッグ用に残しても良い。
    *   JSON出力パース部分 (`--print-json`) は `youtube-dl-exec` の戻り値や `dumpSingleJson` メソッドを活用して簡素化できるか検討。
3.  **動作検証**:
    *   Twitter (X) 動画のダウンロード。
    *   YouTube 動画のダウンロード（もしあれば）。
    *   結合処理 (Video+Audio) が `ffmpeg-static` を使って正常に行われるか確認。
4.  **クリーンアップ**: Dockerfile やセットアップスクリプトからシステムレベルの `yt-dlp`, `ffmpeg` インストール手順を削除（オプション）。

## 懸念点と対応
*   **バイナリダウンロード**: `youtube-dl-exec` はインストール時または初回実行時にバイナリをダウンロードするため、外部ネットワーク接続が必要。
    *   *対応*: CI/CDやDockerビルドプロセスでネットワークアクセスが可能であることを確認する。
*   **実行権限**: `node_modules` 内のバイナリに実行権限が付与されている必要がある。
    *   *対応*: 通常はnpm/bunが処理するが、Docker環境などで問題が出た場合は `chmod` 等で対応。

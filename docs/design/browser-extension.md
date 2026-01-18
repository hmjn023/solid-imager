# ブラウザ拡張機能 (xtracter)

## 概要

**xtracter** は、X (Twitter) のタイムラインから画像・動画を抽出し、solid-imager に保存するための Chrome 拡張機能です。タイムライン上の画像に直接ダウンロードボタンを追加し、メタデータ（ツイート内容、投稿者、URL など）と一緒に保存できます。

### 主な機能

1. **ダウンロードボタンの追加**: タイムライン画像の右上にボタンを表示
2. **一括プレビュー & インポート**: タイムライン上の画像を収集し、ポップアップから一括送信。アプリ側でプレビュー・選別してから取り込み可能。
3. **リッチなメタデータ抽出**: ツイート本文、投稿者情報に加え、タグ付け（将来的な自動抽出含む）に対応。
4. **solid-imager 連携**: oRPC API を通じてメタデータを送信。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     X (Twitter) Web                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Timeline                                            │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Tweet                                         │  │  │
│  │  │  ┌──────────────────────────────────────────┐  │  │  │
│  │  │  │  Image / Video                           │  │  │  │
│  │  │  │  ┌──────────────┐  ┌──────────────┐     │  │  │  │
│  │  │  │  │  DL Button   │  │ POST Button  │     │  │  │  │
│  │  │  │  └──────────────┘  └──────────────┘     │  │  │  │
│  │  │  └──────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────┘
                           ↓ メタデータ収集
┌─────────────────────────────────────────────────────────────┐
│                  xtracter Extension                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Popup (index.html)                                  │  │
│  │  - "Send to Imager (Bulk)" ボタン                     │  │
│  │  - 設定画面                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ POST_PREVIEW メッセージ
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Background Script (index.ts)                        │  │
│  │  - oRPC クライアント                                  │  │
│  │  - API 通信 (downloads.preview)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ oRPC (JSON)
┌─────────────────────────────────────────────────────────────┐
│                    solid-imager API                         │
│  POST /api/rpc/downloads.preview                            │
│  (DB: jobs table -> pending_approval)                       │
└─────────────────────────────────────────────────────────────┘
                           ↓ 通知 & 取得
┌─────────────────────────────────────────────────────────────┐
│                  solid-imager Frontend                      │
│  - Pending Import Notification                              │
│  - Preview Modal -> User Selection -> Approve               │
└─────────────────────────────────────────────────────────────┘
```

---

## 技術スタック

### フレームワーク・ツール

- **TypeScript**: 5.2.2+
- **Vite**: 5.1.4+ (ビルドシステム)
- **@crxjs/vite-plugin**: 2.0.0-beta.28 (Chrome Extension プラグイン)
- **@types/chrome**: 0.0.268 (Chrome API の型定義)

### Chrome Extension API

- **Content Scripts**: ページの DOM を操作
- **Background Scripts**: バックグラウンド処理、API 通信
- **Storage API**: 設定の保存
- **Downloads API**: ファイルのダウンロード
- **Tabs API**: タブ情報の取得

---

## セットアップ

### 1. 依存関係のインストール

xtracter はワークスペースとして管理されているため、ルートディレクトリでインストールします。

```bash
# プロジェクトルートで実行
bun install
```

### 2. 開発ビルド

```bash
# xtracter ディレクトリで実行
cd xtracter
bun run dev
```

ビルド成果物は `xtracter/dist/` に出力されます。

### 3. Chrome に拡張機能を読み込む

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `xtracter/dist/` ディレクトリを選択

### 4. 本番ビルド

```bash
cd xtracter
bun run build
```

---

## ファイル構成

```
xtracter/
├── src/
│   ├── content/
│   │   └── index.ts          # Content Script (DOM操作)
│   ├── background/
│   │   └── index.ts          # Background Script (ダウンロード・API)
│   ├── popup/
│   │   ├── index.html        # ポップアップUI
│   │   └── index.ts          # ポップアップロジック
│   ├── api.ts                # solid-imager API クライアント
│   └── types.ts              # 型定義
├── public/
│   └── icons/                # 拡張機能アイコン
├── manifest.json             # Chrome Extension マニフェスト
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 機能詳細

### 1. ダウンロードボタンの追加

Content Script が Twitter の DOM を監視し、画像が表示されたら自動的にボタンを追加します。

**実装**: `src/content/index.ts`

```typescript
function createButtonContainer(metadata: TweetMetadata, type: 'IMAGE' | 'VIDEO'): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '5px';
  container.style.right = '5px';
  container.style.zIndex = '9999';
  container.style.display = 'flex';
  container.style.gap = '5px';

  // DL ボタン: ローカルにダウンロード
  const dlBtn = createButton(
    type === 'VIDEO' ? 'DL VIDEO' : 'DL',
    '#000',
    () => handleAction(metadata, 'DOWNLOAD', type)
  );

  // POST ボタン: solid-imager にアップロード
  const postBtn = createButton(
    'POST',
    '#0056b3',
    () => handleAction(metadata, 'POST_DOWNLOAD', type)
  );

  container.appendChild(dlBtn);
  container.appendChild(postBtn);
  return container;
}
```

### 2. メタデータの抽出

ツイートから以下の情報を抽出します。

**型定義**: `src/types.ts`

```typescript
export interface TweetMetadata {
  tweetUrl: string;         // ツイートのURL
  tweetText: string;        // ツイート本文
  authorName: string;       // 投稿者の表示名
  authorHandle: string;     // 投稿者の@ハンドル
  timestamp: string;        // 投稿日時
  imageUrl: string;         // 画像の元URL
  videoUrl?: string;        // 動画の元URL（動画の場合）
}
```

**抽出ロジック**: `src/content/index.ts`

```typescript
function extractMetadataFromTweet(element: HTMLElement): TweetMetadata | null {
  // ツイート要素から各種情報を抽出
  const article = element.closest('article');
  if (!article) return null;

  const tweetUrl = extractTweetUrl(article);
  const tweetText = extractTweetText(article);
  const authorName = extractAuthorName(article);
  const authorHandle = extractAuthorHandle(article);
  const timestamp = extractTimestamp(article);
  const imageUrl = extractImageUrl(element);

  return {
    tweetUrl,
    tweetText,
    authorName,
    authorHandle,
    timestamp,
    imageUrl,
  };
}
```

### 3. ダウンロード処理

**ローカルダウンロード** (DL ボタン):
- Chrome Downloads API を使用
- 画像と JSON を同時にダウンロード

**solid-imager アップロード** (POST ボタン):
- Background Script 経由で API にPOST
- メタデータも一緒に送信

**実装**: `src/background/index.ts`

```typescript
async function downloadAndPost(metadata: TweetMetadata, type: 'IMAGE' | 'VIDEO') {
  try {
    // 1. 画像/動画をフェッチ
    const mediaUrl = type === 'VIDEO' ? metadata.videoUrl : metadata.imageUrl;
    const response = await fetch(mediaUrl);
    const blob = await response.blob();

    // 2. FormData を作成
    const formData = new FormData();
    formData.append('file', blob, generateFileName(metadata));
    formData.append('metadata', JSON.stringify(metadata));

    // 3. solid-imager API に POST
    const apiUrl = await getApiUrl(); // Storage から取得
    const uploadResponse = await fetch(`${apiUrl}/api/sources/${sourceId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.ok) {
      console.log('Upload successful');
    } else {
      console.error('Upload failed:', await uploadResponse.text());
    }
  } catch (error) {
    console.error('Error during upload:', error);
  }
}
```

### 4. 設定画面 (Popup)

拡張機能のアイコンをクリックすると表示される設定画面です。

**実装**: `src/popup/index.html` + `src/popup/index.ts`

**設定項目**:
- solid-imager の API URL
- アップロード先のメディアソース ID
- 自動ダウンロードの有効/無効

```typescript
// 設定の保存
async function saveSettings() {
  const apiUrl = document.getElementById('apiUrl').value;
  const sourceId = document.getElementById('sourceId').value;

  await chrome.storage.sync.set({
    apiUrl,
    sourceId,
  });

  alert('Settings saved!');
}

// 設定の読み込み
async function loadSettings() {
  const { apiUrl, sourceId } = await chrome.storage.sync.get(['apiUrl', 'sourceId']);

  document.getElementById('apiUrl').value = apiUrl || 'http://localhost:3000';
  document.getElementById('sourceId').value = sourceId || '';
}
```

---

## 使用方法

### 基本的な使い方

1. **拡張機能をインストール**（上記セットアップ参照）
2. **設定を行う**
   - 拡張機能アイコンをクリック
   - solid-imager の URL とメディアソース ID を入力
3. **Twitter を開く**
4. **タイムラインの画像にボタンが表示される**
5. **ボタンをクリック**
   - **DL**: ローカルにダウンロード
   - **POST**: solid-imager にアップロード

### 動画のダウンロード

動画の場合も同様にボタンが表示されます（"DL VIDEO" と表示）。

**注意**: Twitter の動画は複数の品質があるため、拡張機能は最高品質の URL を自動選択します。

---

## API 連携

### solid-imager へのプレビュー送信 (Bulk Import)

**エンドポイント**: `POST /api/rpc/downloads.preview` (oRPC)

**リクエスト**: `application/json` (ImportItem Schema)

```typescript
// ImportItem[]
const items = [
  {
    imageUrl: 'https://pbs.twimg.com/media/...',
    sourceUrl: 'https://twitter.com/user/status/123',
    description: 'Example tweet',
    author: {
      name: 'User Name',
      accountId: '@username',
    },
    timestamp: '2024-01-01T00:00:00Z',
    tags: [
      { name: 'art', type: 'positive' }
    ]
  }
];

// oRPC call
client.downloads.preview({
  mediaSourceId: "uuid (optional)",
  items: items
});
```

**レスポンス**:

```json
{
  "success": true,
  "jobId": "uuid-of-preview-job",
  "message": "Import data saved for preview"
}
```

### API クライアント実装

**場所**: `src/api.ts`

`@orpc/client` を使用して型安全に通信します。

```typescript
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

export const getClient = async () => {
    // ... config loading ...
    const link = new RPCLink({
        url: url,
        // ... headers etc
    });
    return createORPCClient(link);
};
```

---

## トラブルシューティング

### 1. ボタンが表示されない

**原因**: Content Script が読み込まれていない

**解決策**:
1. 拡張機能を再読み込み（`chrome://extensions/` で「再読み込み」）
2. Twitter のページをリロード
3. コンソールで `xtracter content script loaded` が表示されるか確認

### 2. "Failed to fetch" エラー

**原因**: CORS エラー、または solid-imager が起動していない

**解決策**:
1. solid-imager が起動しているか確認: `bun run dev`
2. API URL が正しいか確認（設定画面）
3. メディアソース ID が正しいか確認

### 3. メタデータが正しく抽出されない

**原因**: Twitter の DOM 構造が変更された

**解決策**:
1. `src/content/index.ts` の抽出ロジックを更新
2. Twitter の最新の DOM 構造を調査（DevTools の Elements タブ）

### 4. 動画がダウンロードできない

**原因**: 動画の URL 抽出に失敗している

**解決策**:
1. コンソールログを確認
2. `extractVideoUrl()` 関数をデバッグ
3. Twitter の動画プレーヤーの構造を再調査

---

## 開発ガイド

### デバッグ方法

1. **Content Script のデバッグ**
   - Twitter のページで DevTools を開く
   - Console タブでログを確認
   - Sources タブで Content Script にブレークポイントを設置

2. **Background Script のデバッグ**
   - `chrome://extensions/` を開く
   - xtracter の「Service Worker」リンクをクリック
   - DevTools が開く

3. **Popup のデバッグ**
   - Popup を開いた状態で右クリック → 「検証」
   - DevTools が開く

### 新機能の追加

#### 例: Instagram 対応

1. **manifest.json を更新**
```json
{
  "content_scripts": [
    {
      "matches": [
        "https://twitter.com/*",
        "https://x.com/*",
        "https://www.instagram.com/*"
      ],
      "js": ["src/content/index.ts"]
    }
  ]
}
```

2. **Content Script を更新**
```typescript
// Instagram の画像を検出
function isInstagramImage(element: HTMLElement): boolean {
  return element.tagName === 'IMG' && element.closest('article') !== null;
}

// Instagram 用のメタデータ抽出
function extractInstagramMetadata(element: HTMLElement): TweetMetadata {
  // Instagram の DOM 構造に合わせて実装
}
```

### ビルドとリリース

1. **バージョンを更新**
```json
// package.json
{
  "version": "0.1.0"
}

// manifest.json
{
  "version": "0.1.0"
}
```

2. **本番ビルド**
```bash
cd xtracter
bun run build
```

3. **ZIP を作成**
```bash
cd dist
zip -r ../xtracter-v0.1.0.zip .
```

4. **Chrome Web Store にアップロード**（オプション）

---

## セキュリティ考慮事項

### 1. API キーの保存

現在は URL とメディアソース ID のみを保存していますが、将来的に API キーが必要になる場合:

```typescript
// ✅ Good: Chrome Storage に保存
await chrome.storage.sync.set({
  apiKey: 'your-api-key',
});

// ❌ Bad: コードにハードコード
const apiKey = 'your-api-key'; // 絶対にやらない！
```

### 2. CORS 対策

solid-imager 側で CORS ヘッダーを設定する必要があります。

**実装**: `src/infrastructure/api/app.ts`

```typescript
export const app = new Elysia()
  .use(cors({
    origin: true, // 開発時のみ
    // 本番環境では特定のオリジンを指定
    // origin: ['chrome-extension://your-extension-id'],
  }));
```

### 3. コンテンツセキュリティポリシー (CSP)

**manifest.json**:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## まとめ

xtracter は、Twitter から画像・動画を solid-imager に直接アップロードできる便利な拡張機能です。

**重要なポイント**:
1. ✅ Vite + @crxjs/vite-plugin で開発
2. ✅ Content Script で DOM 操作
3. ✅ Background Script で API 通信
4. ✅ メタデータも一緒に保存
5. ✅ 設定は Chrome Storage に保存

**今後の拡張案**:
- Instagram, Pixiv などのサイト対応
- 一括ダウンロード機能
- タグの自動抽出
- キーボードショートカット

詳細なコードは `xtracter/src/` ディレクトリを参照してください。

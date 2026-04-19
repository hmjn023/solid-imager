# apps/xtracter

ブラウザ拡張機能。WebページからメディアURLとメタデータを抽出し、solid-imagerサーバーへ送信する。

## 対応サイト

| サイト | コンテンツスクリプト | 抽出内容 |
|---|---|---|
| Twitter / X | `content/twitter.ts` | 画像URL、作者アカウント、ソースURL |
| Danbooru | `content/danbooru.ts` | 画像URL、タグ、キャラクター、IP |
| その他 | `content/index.ts` | 汎用画像URL抽出 |

## アーキテクチャ

```
popup/index.tsx          ← ユーザーUI（送信先ソース選択・ダウンロード実行）
    ↓ chrome.runtime.sendMessage
background/index.ts      ← Service Worker（メッセージルーティング・API呼び出し）
    ↓ HTTP POST
apps/server API          ← solid-imagerサーバー
```

コンテンツスクリプトがページを解析 → backgroundがAPIへ送信 という流れ。

## メッセージプロトコル（`src/schema.ts`）

Zodで型定義された discriminated union メッセージ：

| メッセージタイプ | 用途 |
|---|---|
| `DOWNLOAD` | 単一メディアをサーバーへ送信 |
| `DOWNLOAD_BULK` | 複数メディアを一括送信 |
| `POST_DOWNLOAD` | ダウンロード後にメタデータを登録 |
| `GET_SOURCES` | 利用可能なメディアソース一覧取得 |
| `GET_COOKIES` | 指定URLのCookieを取得（認証付きダウンロード用） |

## `DownloadItem` スキーマ

サーバーへ送るメタデータの構造：

```typescript
{
  targetUrl: string,       // ダウンロードURL（必須）
  description?: string,
  createdAt?: string,      // ISO日時
  sourceUrls?: string[],   // 元ページURL
  authors?: Author[],      // 作者情報
  tags?: Tag[],            // タグ（positive/negative/confidence付き）
  characters?: Character[],
  ips?: IP[],
  cookies?: any[],         // 認証Cookie
  userAgent?: string,
}
```

## background の動作

- リトライ付きバックオフでAPI呼び出し（最大3回）
- `GET_SOURCES` でサーバーから送信先メディアソース一覧を取得してpopupに返す
- Cookieはコンテンツスクリプトが `chrome.cookies.getAll` で取得しbodyに添付

## ソース構成

```
apps/xtracter/src/
├── schema.ts              # Zodメッセージスキーマ定義
├── api.ts                 # サーバーAPIクライアント
├── background/
│   └── index.ts           # Service Worker（メッセージハブ）
├── content/
│   ├── index.ts           # 汎用コンテンツスクリプト
│   ├── twitter.ts         # Twitter/X専用抽出
│   └── danbooru.ts        # Danbooru専用抽出
└── popup/
    └── index.tsx          # ポップアップUI (SolidJS)
```

## ビルド

```bash
bun --filter @solid-imager/xtracter run build
# → dist/ にChrome拡張形式で出力
```

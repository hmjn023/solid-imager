# Danbooru Viewer

サイドバーの **Danbooru** から、ローカルに保存せず投稿を検索・閲覧できる。
Web と Tauri は同じ画面とサーバー側の API を使う。

- 検索欄では Danbooru のタグ式を使う。スペース区切りは AND、`-tag` は除外。
  `rating:g`、`order:score` などのメタタグもそのまま渡す。
- 入力中のタグを API で補完する。候補にはタグ種別と投稿数を表示する。
  別名からの候補取得にも対応し、選択時には正規名を入力する。
- 投稿を開くと既存の MediaViewer で画像・動画を閲覧できる。
  `/danbooru/<投稿ID>` の直接アクセス・再読み込みにも対応する。
- 画像の「取り込み待ちへ」は既存の Import inbox に追加する。
  保存先の選択と実際の取り込みは Import inbox で行う。
  原本 URL がない投稿や、動画・ZIP など画像以外は取り込み対象にしない。
- 検索条件・ページ・入力中の文字列・スクロール位置は、この Viewer 専用の
  sessionStorage に保存する。ローカル検索の条件やプリセットには混ぜない。

## 任意の認証設定

未設定時は匿名アクセスする。検索タグ数や閲覧範囲には Danbooru 側の制限が適用される。
アカウントでアクセスする場合は、サーバーの環境変数を両方設定して再起動する。

```dotenv
DANBOORU_LOGIN=your-login
DANBOORU_API_KEY=your-api-key
```

認証情報はサーバー側の Authorization ヘッダーにだけ使い、ブラウザへ返さない。
ユーザーごとのアカウント切り替えや、お気に入り等のリモート更新は実装していない。

API 通信は `danbooru.donmai.us` 固定で、リクエスト開始間隔を 250ms 以上空ける。
同一リクエストを集約し、投稿は 30 秒、候補は 5 分キャッシュする。
閲覧するメディア URL は HTTPS の `donmai.us` とそのサブドメインに限定する。
メンテナンス・アクセス制限・接続失敗は画面上で再試行できる。

## 検証

`bun run check` と `bun run test` に加え、隔離環境で次を実行する。

```sh
bun run --cwd apps/server test:e2e:dev -- danbooru.responsive.spec.ts
bun run --cwd apps/server test:e2e:production -- danbooru.responsive.spec.ts
```

E2E は外部の検索・画像配信を固定データに差し替え、取り込み待ち登録は実 API と
隔離 DB で検証する。Danbooru 自体の稼働状況とは独立して回帰を検出できる。

API 仕様: [投稿](https://danbooru.donmai.us/wiki_pages/api%3Aposts)、
[タグ](https://danbooru.donmai.us/wiki_pages/api%3Atags)。

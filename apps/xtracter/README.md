# xtracter

xtracter is a Chrome extension that extracts images from X (Twitter), Pixiv, pixivFANBOX, and Danbooru and sends them to Solid Imager. Pixiv ugoira animations are imported as MP4 videos. Direct local downloads are available for X, pixivFANBOX, and Danbooru.

## Features

- Xのタイムライン上にある画像の右上にダウンロードボタンを追加、ローカルに保存可能にする。
- pixivFANBOXの記事画像の右上にダウンロードボタンを追加し、画像CDN URLと元記事URLを保存する。
- Pixivの作品ページ（`/artworks/{id}`、言語プレフィックス付きも対応）では画像ごとにPOSTボタンを追加する。ボタンを押すと作品情報とページ一覧を取得し、その画像の原寸CDN URL、作品URL、作者の固定ID、タグ、説明、投稿日時をManagerへ送る。複数枚の作品も画像ごとに対応する。
  - `sourceUrls` は `[原寸CDN URL, 作品ページURL]` の順で送る。サーバーは末尾の作品URLをHTTPの `Referer` に設定して取得する。PixivのCookieはサーバーへ送らない。
  - うごイラではプレーヤーのPOSTボタンからフレームZIPの `originalSrc` と各フレームの表示時間を送る。サーバーが作品URLをRefererとしてZIPを取得し、フレームの表示時間を反映したMP4へ変換して登録する。プレビュー静止画への置き換えはしない。変換中のファイルを公開せず同名ファイルも上書きしないため、保存先にはハードリンクを作成できるファイルシステム・権限が必要（exFATは非対応）。
  - PixivはPOSTのみ対応し、ブラウザの直接DLは対象外。作品情報・原寸URL・うごイラのフレーム情報を取得できない作品は送信しない。
- タイムライン上にある画像の情報をJSONファイルに出力する。
  - json ファイルには画像のソースURL、元ポストのURL、元ポストの文面、元ポストの投稿日時、元ポストの投稿者の名前、元ポストの投稿者のIDが含まれる
- Managerから現在のXユーザー名でプロフィールを取得し、固定IDを手動確認できる。Managerの確認用リンクを開いたページだけが対象で、X自身が取得するプロフィール情報を利用する。取得結果を確認して更新するまでは登録情報は変更しない。

## Managerでのアカウント確認

`bun run --cwd apps/xtracter build` でビルドした `dist` をChromeへ読み込み、更新時は拡張機能を再読み込みする。ポップアップのAPI URLをManagerと同じサーバーの `/api/rpc` に設定する。

Manager → 作者・外部アカウントで現在の@ユーザー名を入力し、確認ダイアログからXプロフィールを開く。Xにログインしたブラウザでプロフィールの読み込みが完了すると、取得結果がManagerへ戻る。本人のアカウントと照合してチェックを入れ、確認ボタンで登録する。取得に失敗した場合は接続先設定とXへのログインを確認し、Managerから新しい確認用リンクを開く。

## Development

Pixiv対応を既存環境へ反映するときは、サーバーのDBマイグレーション（`author_platform` への `pixiv` 追加）を適用し、拡張機能を再ビルド・再読み込みする。

開発言語はTS、ビルドシステムにはviteを使用する

- manifest、permissions、background/content script、popupはこのworkspaceで管理する。共有パッケージを追加importする前に、拡張機能での実行環境とbundleサイズを確認する。
- manifest・権限・content scriptの変更は、ビルドして拡張機能を再読み込みし、実際の対象ページで動作確認する。
- ビルド・テストはこのworkspaceのscriptsを使う。API契約の変更は `orpc-api`、UI部品の変更は `ui-components` skillも参照する。

```bash
bun run --cwd apps/xtracter build
bun run --cwd apps/xtracter typecheck
bun run --cwd apps/xtracter test
```

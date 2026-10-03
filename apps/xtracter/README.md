# xtracter

xtracter is a chrome extension that extracts images from X (Twitter), pixivFANBOX, and Danbooru and saves them to a local directory.

## Features

- Xのタイムライン上にある画像の右上にダウンロードボタンを追加、ローカルに保存可能にする。
- pixivFANBOXの記事画像の右上にダウンロードボタンを追加し、画像CDN URLと元記事URLを保存する。
- タイムライン上にある画像の情報をJSONファイルに出力する。
  - json ファイルには画像のソースURL、元ポストのURL、元ポストの文面、元ポストの投稿日時、元ポストの投稿者の名前、元ポストの投稿者のIDが含まれる
- Managerから現在のXユーザー名でプロフィールを取得し、固定IDを手動確認できる。Managerの確認用リンクを開いたページだけが対象で、X自身が取得するプロフィール情報を利用する。取得結果を確認して更新するまでは登録情報は変更しない。

## Managerでのアカウント確認

`bun run --cwd apps/xtracter build` でビルドした `dist` をChromeへ読み込み、更新時は拡張機能を再読み込みする。ポップアップのAPI URLをManagerと同じサーバーの `/api/rpc` に設定する。

Manager → 作者・外部アカウントで現在の@ユーザー名を入力し、確認ダイアログからXプロフィールを開く。Xにログインしたブラウザでプロフィールの読み込みが完了すると、取得結果がManagerへ戻る。本人のアカウントと照合してチェックを入れ、確認ボタンで登録する。取得に失敗した場合は接続先設定とXへのログインを確認し、Managerから新しい確認用リンクを開く。

## Development

開発言語はTS、ビルドシステムにはviteを使用する

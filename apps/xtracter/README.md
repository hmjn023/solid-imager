# xtracter

xtracter is a chrome extension that extracts images from X (Twitter), pixivFANBOX, and Danbooru and saves them to a local directory.

## Features

- Xのタイムライン上にある画像の右上にダウンロードボタンを追加、ローカルに保存可能にする。
- pixivFANBOXの記事画像の右上にダウンロードボタンを追加し、画像CDN URLと元記事URLを保存する。
- タイムライン上にある画像の情報をJSONファイルに出力する。
  - json ファイルには画像のソースURL、元ポストのURL、元ポストの文面、元ポストの投稿日時、元ポストの投稿者の名前、元ポストの投稿者のIDが含まれる

## Development

開発言語はTS、ビルドシステムにはviteを使用する

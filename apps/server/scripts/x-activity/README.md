# Xのいいね取り込み試験

OAuth 2.0で自分のアカウントを認可し、Activity Streamから `like.create` の `outbound` を受信するBunスクリプト。通知の `includes.tweets[].attachments.media_keys` と `includes.media` を照合し、添付写真を原寸URLで既存の `downloads.start` に投入する。本文、投稿日時、作者名、ユーザー名、固定IDも渡す。

写真URLが届くか確かめるため、受信JSONを保存する。写真の取り込み対象は `pbs.twimg.com/media/` の `photo`。画像情報が欠ける場合はログに件数0を出す。追加のPost Lookup呼び出しは行わない。

## 初回設定

X Developer ConsoleでアプリのOAuth 2.0を有効にする。Native AppならClient ID、Web App / Automated AppならClient IDとClient Secretを用意する。Callback URLに `http://127.0.0.1:8788/callback` を完全一致で登録する。

```sh
cd apps/server
cp .env.x-activity.example .env.x-activity.local
```

`.env.x-activity.local` に `X_CLIENT_ID`、必要なら `X_CLIENT_SECRET` を記入する。Solid Imagerが別ホストなら `IMAGER_API_URL` も設定する。

```sh
bun --env-file=.env.x-activity.local scripts/x-activity.ts auth
```

端末に表示されたURLを、スクリプトを実行しているPCのブラウザで開き、自分のXアカウントを認可する。要求scopeは `tweet.read users.read like.read offline.access`。ブラウザがコールバックに戻った後、端末に `X authorization saved` が出れば完了。

トークンは `apps/server/.data/x-activity/tokens.json` に所有者だけが読める権限で保存する。アクセストークンの期限が近づくとrefresh tokenで更新する。Xの認証情報はX APIへのリクエストだけに使う。

## 通知だけ確認する

```sh
bun --env-file=.env.x-activity.local scripts/x-activity.ts listen --capture
```

Xで写真付き投稿をいいねする。端末に `Received X like` と `photos` の件数が出る。生の通知は `.data/x-activity/events.ndjson` に追記される。`--capture` はSolid Imagerへの接続や保存先設定なしでも動く。Xのイベント配信料金は通常どおり発生する。

## Solid Imagerへ保存する

Solid Imagerサーバーを起動して、保存先のソースIDを調べる。

```sh
bun --env-file=.env.x-activity.local scripts/x-activity.ts sources
```

出力されたIDを `.env.x-activity.local` の `IMAGER_SOURCE_ID` に設定し、次を起動する。

```sh
bun --env-file=.env.x-activity.local scripts/x-activity.ts listen
```

起動後にいいねした投稿の添付写真をすべてキューに入れる。`Queued X photos in Solid Imager` が出たらManagerのジョブとメディアを確認する。取り込み済みイベントは保存先ごとに `.data/x-activity/queued.ndjson` に記録し、再配信やreplayでの二重投入を抑制する。実際のダウンロード失敗はManagerのジョブ画面で確認・再試行する。

ネットワーク切断時は最大60秒のbackoffで再接続する。Ctrl+Cで受信を終了する。試験用の購読は作成から24時間で期限切れになる。継続試験時は期限後に `listen` を起動し直す。既存の有効なoutbound購読があれば再利用する。受信停止中のイベントを遡って取得する処理はない。

## 保存した通知を再処理する

`listen` に表示された自分の数値IDを `X_USER_ID` に設定する。

```sh
bun --env-file=.env.x-activity.local scripts/x-activity.ts replay .data/x-activity/events.ndjson --capture
bun --env-file=.env.x-activity.local scripts/x-activity.ts replay .data/x-activity/events.ndjson
```

replayは保存した通知だけを読み込む。認証前の動作確認にも使える。サーバーへ投入できなかった通知もこの方法で再試行できる。保存先と受信JSONのディレクトリは `X_ACTIVITY_DIR` で変更可能。

## 検証

```sh
bun run test:x-activity
```

通常のルート `bun run test` と server の `test:unit` にも含まれる。テストは一時ディレクトリとローカルRPCを使い、Xへの接続は発生しない。

認証と実データの配信はXアプリの設定後に確認する。写真URLが届かない通知は `events.ndjson` の `includes.tweets`・`attachments`・`includes.media` を確認する。

仕様は [Activity Stream](https://docs.x.com/x-api/activity/activity-stream)、[like.create](https://docs.x.com/x-api/activity/event-payloads#like-create)、[OAuth 2.0 PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) を参照。

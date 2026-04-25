---
name: indexion
description: solid-imager リポジトリで indexion を使った wiki / digest / search / graph の管理、`.indexion/wiki` の更新、`.agents/skills` と `AGENTS.md` の追跡を行うときに使用してください。
---

# indexion Skill

`indexion` はこのリポジトリのソース探索と wiki 管理の補助ツール。

## 使う場面

- `.indexion/wiki/*.md` を追加・更新する
- `AGENTS.md` や `.agents/skills/*.md` の変更を wiki 側に反映する
- wiki の構造チェック、索引再生成、差分確認をしたい
- ソースコード、wiki、skill 文書の横断検索をしたい

## 基本ルール

- shell コマンドは `rtk` を先頭に付ける
- `indexion` 単体ではなく、必ず subcommand を指定する
- 生成物と手編集対象を分ける
- `wiki.json` はページメタデータの実体として扱う
- `index.md` と `log.json` は必要に応じて再生成される前提で扱う

## よく使うコマンド

```bash
rtk indexion wiki pages ingest --dry-run
rtk indexion wiki lint
rtk indexion wiki index build
rtk indexion search "<query>"
rtk indexion grep "<pattern>"
rtk indexion doc graph
```

## wiki 更新手順

1. 変更したいページを特定する
2. ページ本文を編集する
3. 参照元が増減したら `sources` も更新する
4. `rtk indexion wiki lint` で構造を確認する
5. `rtk indexion wiki index build` で索引を更新する

### ページ追加

- 新しい wiki ページは `rtk indexion wiki pages add` で登録する
- `--sources` には監視したいソースを列挙する
- `--provenance synthesized` を基本にする

### ページ更新

- 既存ページは `rtk indexion wiki pages update` で更新する
- `--sources` は差分追加ではなく、**全体を置き換える**
- 追跡対象を増やすときは、実在するファイル/ディレクトリだけを入れる

## skills を追跡するとき

- `.agents/skills/<name>/SKILL.md` を wiki の追跡対象に含める
- 新しい skill を作ったら `.indexion/wiki/skills.md` の一覧も更新する
- `AGENTS.md` も一緒に入れると、skill と上位ルールのズレを見つけやすい

## 注意点

- `wiki lint` は構造と参照関係のチェックが中心で、実装との意味論的な矛盾までは判定しない
- `search` や `grep` は便利だが、最終確認は実ファイルを読む
- 大きな更新後は `index build` を忘れない

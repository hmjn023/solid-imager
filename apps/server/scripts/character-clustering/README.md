# CCIP + HNSW + TypeScript HDBSCAN

Bun / TypeScriptだけで、保存済みCCIPの近傍抽出・疎なグラフの保存・HDBSCAN・結果比較を実行する検証ツール。Python、NumPy、SciPy、uvの実行依存はない。

## 実行

`apps/server` をカレントディレクトリにする。通常の `bun install` で導入済みの `pg`・Zod・Pinoを使用し、新しいNode依存は追加していない。

```sh
bun scripts/cluster-characters.ts extract \
  --output ../../.cache/character-clustering/ts-trial/graph \
  --neighbors 64 --ef-search 256 --recall-samples 16

bun scripts/cluster-characters.ts fit \
  --graph-dir ../../.cache/character-clustering/ts-trial/graph \
  --output ../../.cache/character-clustering/ts-trial/eom-32 \
  --neighbors 32 --min-cluster-size 5 --min-samples 1 --selection-method eom

bun scripts/cluster-characters.ts compare \
  --runs ../../.cache/character-clustering/ts-trial/eom-32 \
  --runs ../../.cache/character-clustering/another-run \
  --output ../../.cache/character-clustering/ts-trial/comparison
```

保存済みの実データを再利用する例:

```sh
bun scripts/cluster-characters.ts fit \
  --graph-dir ../../.cache/character-clustering/2026-10-29/graph-64-indexed \
  --output ../../.cache/character-clustering/2026-10-29/ts-new-run \
  --neighbors 32 --min-cluster-size 5 --min-samples 1 --selection-method eom
```

出力先は毎回新しいディレクトリを指定する。既存結果は上書きしない。

## 対象とDB接続

`extract` だけがPostgreSQLへ接続する。Bunが `apps/server/.env` を読み込み、`DB_HOST`、`DB_PORT`、`DB_DATABASE`（または `DB_NAME`）、`DB_USER`、`DB_PASSWORD` を使用する。対応する `PG*` 変数にも対応する。資格情報は引数や結果に保存しない。

アプリ全体をbootstrapせず、専用の読み取り専用接続を開く。workerや自動タグ付けを起動しない。REPEATABLE READ / READ ONLYの同じトランザクションで対象・近傍・監査を取得する。

- activeな画像、画像全体の現行CCIPモデル・version、非ゼロベクトルが対象。
- 特徴量抽出後に変更された画像、キャラクター登録が複数ある画像は除外する。
- デフォルトは `solo` タグ付きのみ。人物cropや人数モデルは使用しないためタグ誤りは残る。
- `--include-without-solo` でsolo条件を外せる。複数人画像が混ざる可能性がある。
- `--source-id UUID` を明示した場合だけソースを限定する。
- `--batch-size` は取得処理の単位。近傍候補は同じバッチの画像に限定せず、対象全体から探す。
- 距離はpgvectorのコサイン距離。CCIP距離モデルのしきい値0.3は使用しない。

pgvector 0.8以上が必要。HNSWインデックス `idx_ccip_embeddings_embedding_cosine` を利用する。`ORDER BY embedding <=> anchor LIMIT k` とiterative scanを使い、単一anchorとbatchの両方の実行計画にHNSWがなければ停止する。

固定seedの画像サンプルについて正確な全件検索と比較し、近傍Recall@kを保存する。同距離の候補が多い場合はID集合によるrecallが低く出ることがある。サンプル監査は全点の保証ではない。

## TS版HDBSCAN

本体は `packages/application/src/utils/sparse-hdbscan.ts`。DBやBunには依存せず、TypedArrayを使う。

1. kNNの観測辺を対称CSRへ変換。相互の辺は加算せずmaxで統合する。
2. 対称グラフから各点のcore distanceとmutual reachabilityを求める。
3. Kruskalの最小全域森から単連結階層を構築する。
4. 最小クラスタサイズで階層を縮約し、stabilityを計算する。
5. EOMまたはleafでクラスタを選択する。各連結成分のroot全体を1キャラクターとはみなさない。

全画像ペアの密行列は作らない。主要メモリはO(Nk)、辺の並べ替えはO(E log E)。深い階層も再帰せず処理し、クラスタごとに全メンバー一覧を保持しない。

未観測の辺を距離0で埋めない。観測された距離0だけ、疎行列で辺が消えないよう1e-12へ置き換える。小さい連結成分はnoiseに残し、十分なサイズの成分で近傍数が不足する場合はエラーにする。

HNSWとグラフの疎化による近似は残る。保存するkと `ef-search` は別のパラメータ。kを変えた結果も比較する。TSでは同距離辺を頂点ID順で決定的に処理するため、NumPyの同距離の並べ替え順と違う設定ではPython版と分割が異なる場合がある。完全なビット単位互換を保証しない。実データでの比較は検証記録を参照。

## 保存物

graphディレクトリ:

- `graph.json`: 対象条件、snapshot、k、HNSW設定、所要時間、近傍recall、チェックサム。
- `query-plan.json`: 単一anchorとbatchの実行計画。
- `media.jsonl`: 画像・特徴量ID、タイムスタンプ、既存ラベル。ベクトル本体や認証情報は含めない。
- `indices.npy`、`distances.npy`: N×kの数値配列。旧実験結果と互換のバイナリ形式をTSだけで読み書きする。ヘッダーをコードとして評価しない。

fitディレクトリ:

- `assignments.jsonl`: 画像ごとのrun内クラスタID、noiseは-1、membership strength。
- `clusters.json`: グループサイズ、persistence、表示確認用サンプル、既存ラベル内訳。
- `summary.json`、`report.md`: 分類数、noise、所要時間、各段階の時間、Linuxのpeak RSS、既存ラベルのpair precision / recall。

membership strengthは識別確率ではない。既存ラベルは誤りを含む参考情報であり、正解データではない。クラスタを作るためには使わず、結果の監査にだけ使う。未分類画像の正しさはラベル監査だけでは確認できない。

`compare` は同じ順序・同じ特徴量のsnapshotだけを受け付ける。クラスタ番号の付け替えに依存しないARIと、noise判定の一致率を比較する。旧Python実験の保存結果も入力できる。

## 画面で確認

Web / Tauriの `/manager` → **キャラクタークラスタリング** から、保存済みの解析結果を確認できる。

- グループ一覧は所属が強い3枚と弱い3枚を表示する。グループ・ノイズ・全メンバーは仮想スクロールで確認でき、表示範囲付近の行だけを描画する。
- 続きはスクロールに応じてグループ24群・画像48枚ずつ取得する。取得済みの内容を保ったまま戻りスクロールでき、追加取得の失敗はその続きから再試行できる。
- ノイズ一覧・既存ラベル/ファイル名での絞り込み・混在ラベル優先の並べ替えに対応する。
- 同じ画像一覧の別設定を選び、各画像の比較先グループ/ノイズへ移動できる。番号はrun内だけで有効。
- グループカードをクリックすると、全所属画像の仮想スクロールグリッドをモーダルで表示する。サムネイルの通常クリックは同じタブのメディア詳細へ移動する。既存ラベルのボタンは絞り込みに使える。
- 「クラスタリングを開始」で近傍数・最小クラスタ枚数・密度の最小サンプル数・グループ選択方法を指定して解析ジョブを投入できる。保存済みCCIPのあるsolo画像を全ソースから対象にし、近傍抽出とHDBSCANを実行する。PostgreSQL / pgvectorとHNSWインデックスが必要で、CCIPがない画像の特徴量抽出は別途実行する。
- 状態はJobsで確認し、完了後に「結果を再読み込み」で新しい結果を表示する。既存結果は上書きせず、キャラクター登録への自動反映は行わない。キャンセルは各処理段階の間で確認し、未公開の途中結果は削除する。

既定の読み込み元はリポジトリ直下の `.cache/character-clustering`。配備環境では `CHARACTER_CLUSTERING_DIR` を明示できる。root直下、または1階層の日付・実験フォルダー配下のrun/graphを検出する。runには `summary.json` と `assignments.jsonl`、同じチェックサムのgraphには `graph.json` と `media.jsonl` が必要。メディア本体は既存のソースから取得する。

APIはローカルパス・SQL実行計画・生のmanifestを返さない。全結果はサーバー内で検証・キャッシュし、ブラウザーにはページ分だけ返す。

## インクリメンタル運用

今回の実データではTSのHDBSCAN自体は数秒で終わる。差分化を進めるなら、最初の候補はDBからの近傍抽出・グラフ更新。新点だけでなく、影響を受ける既存点の近傍・密度も更新する必要がある。

承認済みキャラクターへの日常的な追加割り当てと、新キャラクター発見のための再クラスタリングを分ける。クラスタ番号は再実行で変わり得るので永続的なキャラクターIDとして使わない。差分グラフ更新や自動ラベル付けは未実装。

## 検証

```sh
bun run test:unit -- src/tests/unit/application/services/sparse-hdbscan.test.ts \
  src/tests/unit/infrastructure/character-clustering-snapshot.test.ts \
  src/tests/unit/infrastructure/character-clustering-review.test.ts

bun run test:e2e -- character-clustering.responsive.spec.ts \
  --project=responsive-desktop --project=responsive-320 --project=responsive-375
```

既知のクラスタ・noise、EOMとleaf、core distanceの影響、非連結成分、近傍不足、ゼロ距離、深い階層、数値ファイルの相互運用、ARI、HNSWクエリ条件を確認する。実DB全体の68,674枚で保存済みPython結果と比較し、別の使い捨てPostgreSQLでTSだけの抽出も確認する。

原理: [HDBSCAN論文](https://doi.org/10.1007/978-3-642-37456-2_14)、[参照実装](https://github.com/scikit-learn-contrib/hdbscan)、[pgvector](https://github.com/pgvector/pgvector)、[NPY形式](https://numpy.org/doc/stable/reference/generated/numpy.lib.format.html)。

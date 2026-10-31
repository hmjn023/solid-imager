# HDBSCANのTypeScript移行と実データ検証

Python実験をBun / TypeScriptへ置き換えた。DB抽出・グラフ保存・HDBSCAN・結果比較までTSで実行する。Pythonの実行ファイル・依存定義は削除し、新しいnpm依存やRustの実装は追加していない。

実行方法は [README](../../apps/server/scripts/character-clustering/README.md)。アルゴリズム本体は `packages/application/src/utils/sparse-hdbscan.ts`、実行入口は `apps/server/scripts/cluster-characters.ts`。

## 方針

調査した `hdbscan-ts` はN×Nの距離行列を生成するため、今回の68,674枚には採用しなかった。保存済みkNNを使い、TypedArrayと疎なCSRグラフからHDBSCANを実行する実装を追加した。

処理は、対称kNN → core distance → mutual reachability → Kruskalの最小全域森 → 単連結階層 → 最小クラスタサイズによる縮約 → stability → EOM / leaf。再帰や、各クラスタでの全メンバーの保持を避け、グラフを密行列へ戻さない。

## 候補設定での実データ比較

初回実験と同じ68,674枚・同じ保存済みグラフを使用。`neighbors=32 / minClusterSize=5 / minSamples=1 / selectionMethod=eom / allowSingleCluster=false`。

| 項目 | Python基準 | TypeScript最終実行 |
| --- | ---: | ---: |
| 対象 | 68,674枚 | 68,674枚 |
| クラスタ数 | 1,899 | 1,899 |
| グループに入った画像 | 35,230枚 | 35,230枚 |
| noise | 33,444枚 | 33,444枚 |
| 既存ラベル pair precision | 94.089% | 94.089% |
| 既存ラベル pair recall | 36.653% | 36.653% |
| fit所要時間 | 7.395秒 | 1.240秒 |
| Linux peak RSS | 996.6MiB | 619.8MiB |

画像ごとの分割をクラスタ番号の付け替えに依存しないARIで比較し、**ARI=1、noise判定一致率=1**。集計値の一致だけで判断していない。

TS最終実行の内訳は、対称グラフ生成261ms、階層生成809ms、クラスタ選択9ms。fitにはsnapshotの読み込み・チェックサム検証・集計も含む。所要時間は画像ごとの結果をディスクへ書き出す直前までの測定で、DBの近傍抽出時間は含まない。初回のTS試行は1.807秒・609.6MiBだった。ベンチマーク専用の無負荷環境ではないため、普遍的な速度差としては扱わない。

結果はローカルの以下に保存した:

- `.cache/character-clustering/2026-10-29/ts-eom-32-s1-final/`: 最終TS結果。
- `.cache/character-clustering/2026-10-29/ts-final-comparison/`: Python基準との比較。

## 他の設定と互換性の制約

全設定でPythonと完全一致する実装とは扱わない。`minSamples=3` の設定も確認した。

| 設定 | Pythonクラスタ数 | TSクラスタ数 | ARI（全画像） | ARI（両方で分類済み） | noise判定一致率 |
| --- | ---: | ---: | ---: | ---: | ---: |
| k64 / 最小5 / samples3 / leaf | 1,492 | 1,488 | 0.95654 | 0.99568 | 98.427% |
| k64 / 最小5 / samples3 / eom | 1,330 | 1,321 | 0.98081 | 0.99860 | 99.260% |

TSは同距離の辺を頂点ID順に処理する。SciPyのMST生成後にNumPyが同距離の辺を並べる順序とは異なり、同距離を二分木へ落とす際の扱いは互換対象にしていない。`minSamples>1` ではcore distanceによって同じ重みの辺が増える。今回の差にはこの扱いが影響し得るため、別設定を使う場合も分割結果を比較する。候補設定での一致から、あらゆる入力・設定での一致を推定しない。

これは実行言語の移行検証であり、キャラクター識別の正しさを新たに検証したものではない。候補設定の33,444枚のnoiseと、同名キャラクターの分断は残っている。既存ラベルは誤りを含む参考情報で、pair precisionを未分類画像の正解率とは扱わない。

## TSだけのDB抽出検証

既存データDBとは別の、使い捨てpgvector 0.8.6 / PostgreSQL 18に512件の合成データとHNSWを作成した。

- TSで全512件を抽出・保存し、正確な検索との4サンプル監査はRecall@16=1。
- 保存した数値ファイルをTSで再読込し、HDBSCANまで実行できた。
- 古い特徴量、soloタグなし、複数キャラクター、archived、旧モデル、ゼロベクトル、full以外、動画、別ソースの9件を除外する条件を作り、対象が503件になることを確認した。
- HNSWを使う単一anchorとbatchの実行計画を保存し、READ ONLY / REPEATABLE READで処理した。
- 小さな合成データでもインデックスを通る経路を検証するため、この検証接続だけ `enable_seqscan=off / enable_sort=off` を指定した。通常の抽出ツールにはこの強制設定を入れていない。

実データの全近傍抽出は今回繰り返さず、既存の保存済みグラフを再利用した。したがって、初回実験の約8分半をTS抽出の測定値とは主張しない。

## 判断

今回の規模ではHDBSCAN本体をRustへ移す性能上の必要性は確認されなかった。まずTSで進める。

次の最適化候補はDBの近傍抽出とグラフ更新。新規・変更画像と、それによって影響する既存点の近傍を更新し、HDBSCAN本体は全体を再実行する構成を検討できる。差分グラフ更新と承認済みキャラクターへの追加割り当ては未実装。保存結果の確認画面は後続作業でManagerへ追加済み（下記）。

## 検証

新規のTS回帰テスト12件と、`bun run check`、`bun run test` が通過。scripts配下は別途OxlintとOxfmtも確認した。checkには変更箇所以外のUIギャラリーで既存の警告が1件ある。

既知のクラスタ・noise、EOMとleaf、core distanceの影響、非連結成分、近傍不足、ゼロ距離、深い階層、数値配列の読書き、ARI、HNSWクエリの条件を検証した。実験結果の保存物にはローカルの画像ID・キャラクター名が入るため、gitには追加していない。

参考: [TSライブラリの全距離行列](https://github.com/GeLi2001/hdbscan-ts/blob/main/src/hdbscan/core.ts)、[SciPy MSTと同距離での制約](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csgraph.minimum_spanning_tree.html)、[HDBSCAN参照実装](https://github.com/scikit-learn-contrib/hdbscan)。

## 保存結果の確認画面

Web / TauriのManager → キャラクタークラスタリングに、保存済みrunのグループ・境界画像・ノイズ・同じ対象の別設定比較を追加。実データ68,674枚の読み込み、1,899群の集計、24群のページ取得を確認した。初回読み込み込みで約207ms（単回測定）。

画面は閲覧用。元のキャラクター登録や解析結果を書き換えない。グループ・ノイズ・所属画像の仮想スクロール、グループカードからのモーダル表示、サムネイルから同じタブの詳細ページへの遷移に対応する。隔離したfixtureで開発版/本番版、デスクトップ/320px/375px/768pxの24 E2Eケースが再試行なしで通過。全体のcheck・unit/integrationテストも通過。

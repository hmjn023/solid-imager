# AI推論のメモリ保護

外部AI APIとlocal background workerは、同じprocess内のnative推論枠を共有する。local推論は常に1件ずつ実行し、待機は最大16件に制限する。PixAI・CCIP・OppaiOracle・検出・透過処理・CCIP距離計算の全native呼び出しを対象とする。同じモデルのcold loadが競合して複数sessionを構築する経路を、このadapterで防ぐ。native依存ライブラリ自体のcache実装は変更していない。

`jobs.aiConcurrency`はremote接続時のbackground workerのclaim数を制御する。localではnative推論に合わせてclaimも1件に制限し、余った要求はDBで待機させる。HTTP受付を含む推論の上限を、background jobのclaim数だけに任せない。

`TOO_MANY_REQUESTS`は推論の容量待ちとして5秒後に再開し、処理の試行回数を消費しない。ネットワーク障害・推論エラーの上限付き再試行とは区別する。以前の容量超過で既に失敗したbatchは、修正版への更新後にRetryで再開する。

## HTTP受付

`/api/rpc/ai/{tag,tagOppaiOracle,ccipFeature,ccipDifference,ccipDistances,detectAndCropCharacters}`は、bodyを読む前に最大4件を受付ける。受付からbody解析・推論・応答処理が終わるまで枠を保持し、5件目以降は429と`Retry-After: 5`を返す。native待機上限に達した場合も429を返す。health・状態取得・job投入・通常のmedia uploadにはこの制限を適用しない。

各AI request bodyはmultipartのoverheadを含めて17MiBが上限。Content-LengthがなくてもFetch/Node両adapterのBodyLimitPluginで実際に読んだbytesを数え、超過を413として拒否する。最大4件という受付数は保持中bodyの量を制限するもので、モデル・展開画像・レスポンスを含むprocess全体のメモリ上限ではない。

クライアントがtimeout/切断してもnative関数を強制終了できないため、実行枠はnativeのPromiseが本当に終了するまで解放しない。新しい要求を無制限に実行しない。満杯なら429を返し、HTTP要求を別の永続queueへ移さない。background処理が失敗した場合は既存の永続状態とretry操作で復旧する。

remote clientのtimeoutは`ai.timeoutMs`を共通clientへ渡す。以前はこの指定が欠けており、設定120秒でも既定30秒で打ち切られていた。修正を送信側へ適用すると設定値が有効になる。timeout延長だけでは受信側のメモリ保護にはならない。

## 検証と残る切り分け

単体テストは実モデル・GPUを読み込まず、数件のmock推論でcold load競合、異なるclient/model間の直列化、有限待機、失敗後の復旧、120秒設定を検証する。body制限は100byte未満のstreamと小さな上限でFetch/実Node HTTPの双方を確認する。大きなファイルやbulk要求でOOMを再現する必要はない。

テストをホストから隔離する例:

```sh
systemd-run --user --scope --quiet -p MemoryMax=2G -p MemorySwapMax=0 \
  bun run --cwd apps/server test:unit src/tests/unit/infrastructure/ai
```

これらは重複実行の防止を確認するテストであり、Intel GPU/OpenVINOの単一モデルのpeak使用量や、warm推論の反復で発生するnative/runtime leakの有無は証明しない。実推論を測る場合は別processへメモリ・swap・時間の上限を付け、cold1回と少数のwarm直列推論から始める。稼働AIサーバへのbulk再送はしない。異なるprocess/server instance間ではこの枠を共有しないため、AIサーバはまず1processで運用する。

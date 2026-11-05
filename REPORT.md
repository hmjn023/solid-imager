# UI implementation report

WebとTauriは `DESIGN.md` と Design Lab を基準にした共有ワークスペースを使用します。`/search`、`/sources/:sourceId`、`/manager`、`/jobs`、`/config`、`/about` は検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送を実データへ接続しています。未対応機能は推測データを表示せず無効化しています。

## Current implementation status

| 領域 | 現状 | 主な実装 |
| --- | --- | --- |
| Jobs一覧・詳細・artifact download | 実装済み | `packages/core/src/domain/contract/jobs.contract.ts`、`apps/server/src/infrastructure/api/routers/jobs-router.ts`、`packages/ui/src/screens/jobs-screen.tsx` |
| JobのRetry / Cancel / realtime更新 | 実装済み | Jobs contract/router、`jobs-screen.tsx`、Jobイベント購読 |
| Sourceの件数・同期状態 | 実装済み | `sources-router.ts` の `mediaCount` / `syncStatus` |
| Managerの利用件数 | 実装済み | `entity-media-counts.ts` と Project / IP / Character router |
| キャラクタークラスタリングの目視確認 | 実装済み | Managerの専用ツール。保存済みHDBSCAN結果のグループ・境界例・ノイズを仮想スクロールで表示し、別設定との比較も確認 |
| Export / Restore | 実装済み | Web / TauriのManagerから転送Jobをキューへ登録し、共有Jobs画面で追跡・ダウンロード |
| AI接続状態・latency | 実装済み | `ai.health` contract/router と Config画面 |
| リロード後の前後メディア移動 | 実装済み | `packages/ui/src/media-context.ts` と sessionStorage |
| 関連メディアのおすすめ | 実装済み | Web / Tauriの詳細画像下で「おすすめ・似た画像・同じキャラ・同じIP・タグが近い」を表示。`packages/ui/src/related-media.tsx` と `media.getRelated` |
| Collectionのgrid / list表示 | 実装済み | `packages/ui/src/source-media-grid.tsx` と Search / Source画面 |
| Web / Tauriの共有画面 | 実装済み | `packages/ui/src/layouts/app-shell.tsx`、`screens/`、詳細・モーダル部品。各アプリはAPI・ルーティング・実行環境を接続 |
| Tauriの接続先管理とネイティブ連携 | 維持 | `/servers`、端末内の接続設定、サーバーごとのSQLiteキャッシュ、HTTP・メディア取得 |

未対応の画面やAPIを追加する場合は、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。

関連メディアは全ソースの有効な画像が対象です。キャラ・IPはメディアへの直接の関連付けIDで照合し、自分自身と重複を除外します。「似た画像」は作成済みのEmbeddingGemma 2画像検索インデックスを使い、詳細表示時のAI処理は行いません。未作成・更新前のインデックスでもキャラ・IP・タグの候補は表示できます。

タグはpositiveのみを対象に、出現頻度と信頼度を考慮した重み付き一致で比較します。negativeタグは使わず、信頼度未設定の手動タグは有効な一致として扱います。「おすすめ」は広めに集めた候補から関連度に応じて12件を重複なしで抽選し、同作者やほぼ同じタグ集合の画像が続くのを抑えます。キャラ・IP候補は新着だけに限定せず、古い画像も選べるようにしています。種類別タブはそれぞれ最大12件で、「似た画像」の類似順は維持します。

抽選用seedを画像ごとにセッション内で保持し、閲覧中・戻る・再読み込みでは同じ並びを再現します（候補データが変わった場合を除く）。更新操作ではseedを変えて別のおすすめを取得し、通信エラー時の再試行では同じseedを使います。関連画像をたどっても元の一覧の検索・戻り先を保持します。

## UIの命名とルーティング

- 現行画面にはバージョン名を付けず、機能名と `workspace` のデザイン名を使います。Web / Tauriで画面の実装を分けません。
- Tauriの仮ホーム画面や旧ナビゲーション・旧画面部品は廃止し、`/` は `/search` へ転送します。ソース管理は共有サイドバー、Export / RestoreはManagerから操作します。

## ブラウザー検証

隔離E2Eは一時PGliteとメディアを使います。Tauriの検証用ブラウザーも実際の `apps/tauri` のエントリーポイント・ルーター・画面を読み込み、同じ隔離APIへ接続します。テスト専用アダプターがネイティブHTTP・設定ストア・SQLite永続化を置き換えるため、この検証でネイティブIPCやSQLite自体の動作確認を代替することはできません。

# Vinxiゾンビプロセス問題 — 調査レポート

## 概要

`bun run dev` (`bun x --bun vinxi dev`) でサーバーを起動すると、BunとNodeが別プロセスとして起動する構成になっており、Ctrl+C でBunが終了してもNodeが残ってゾンビ化し、2コア100%・2GB超のリソースを消費する。

---

## 調査したファイル

| ファイル | 概要 |
|---|---|
| `apps/server/package.json` | `dev: bun x --bun vinxi dev` でVinxiを起動 |
| `apps/server/app.config.ts` | ViteにHMR/watch設定なし、alias経由でpackages/coreを直接参照 |
| `apps/server/src/entry-server.tsx` | サーバー起動時に `bootstrap()` と `startMonitoringAll()` を呼ぶ |
| `apps/server/src/infrastructure/bootstrap.ts` | JobWorker起動。HMR管理は `globalThis.__JOB_WORKER__` で実装済み |
| `apps/server/src/infrastructure/jobs/sse-manager.ts` | chokidarで `persistent: true` のウォッチャーを管理 |
| `apps/server/src/infrastructure/jobs/file-watcher-service.ts` | 起動時に全ローカルソースの監視を開始 |
| `apps/server/src/application/services/directory-sync-service.ts` | 起動時にfull scanしてDBと差分を同期 |
| `packages/core/package.json` | `exports: "."` = `"./src/index.ts"` — ビルドなし、TSソース直接参照 |
| `packages/ui/package.json` | `exports: "./*"` = `"./src/*"` — ビルドなし、TSソース直接参照 |

---

## 特定された原因候補

### 🔴 原因1: `persistent: true` の chokidar ウォッチャーがプロセスを生かし続ける（最有力）

**ファイル:** `sse-manager.ts` L131–139

```ts
const watcher = chokidar.watch(watchPath, {
  persistent: true,   // ← これがNodeプロセスのevent loopを生かし続ける
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100,  // ← 100msごとにポーリング
  },
});
```

`persistent: true` はNodeのイベントループを「このwatcherが存在する限り終了しない」ようにする設定。  
VinxiがHMRのためにモジュールをリロードした際、**古いウォッチャーを `close()` せずに新しいウォッチャーを作成してしまう**と、ゾンビwatcherが積み上がる。

`stopFileSystemMonitoring` を呼ぶコードパスは `file-watcher-service.ts` 経由のみで、**プロセス終了シグナル（SIGTERM/SIGINT）ではcloseされない。**

---

### 🔴 原因2: HMRリロード時に `entry-server.tsx` が複数回実行される

**ファイル:** `entry-server.tsx` L5–19

```ts
if (typeof window === "undefined") {
  import("~/infrastructure/bootstrap").then(({ bootstrap }) => {
    bootstrap();  // isBootstrapped フラグで2重実行防止
  });

  import("~/infrastructure/jobs/file-watcher-service")
    .then((module) => {
      module.FileWatcherService.startMonitoringAll();  // ← 2重実行防止なし！
    });
}
```

- `bootstrap()` は `isBootstrapped` フラグで2重起動を防いでいるが
- `FileWatcherService.startMonitoringAll()` には **同等の保護がない**
- HMRでモジュールがホットリロードされると `entry-server.tsx` が再実行され、`startMonitoringAll()` が複数回呼ばれる
- `startMonitoringAll` → `startMonitoring` → `SseManager.stopFileSystemMonitoring` → 既存を停止 → 新規作成、という流れはあるが、`isBootstrapped` と同じモジュールスコープで管理されていないため**HMR後のモジュール差し替えで無効化される**

---

### 🔴 原因3: packages/core・packages/ui をソース直接参照していることによるViteの監視爆発

**ファイル:** `app.config.ts` L12–16, `packages/core/package.json`, `packages/ui/package.json`

```ts
// app.config.ts のalias
"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
"@solid-imager/ui/*": "../../packages/ui/src/*",  // tsconfig経由
```

両パッケージは **ビルド済み成果物なし、TypeScriptソースを直接参照**。  
つまりVite/Vinxiの**ファイルウォッチ対象が `packages/core/src` と `packages/ui/src` まで広がっている**。

モノレポ分離前は1つのパッケージ内のファイルのみがViteの監視対象だったが、分離後はワークスペース横断でソースが監視され、**node_modulesシンボリックリンク経由の循環監視**が発生している可能性がある。

特に `packages/core/node_modules` → `packages/ui/node_modules` → `apps/server/node_modules` のシンボリックリンクをViteが追いかけてしまうと、再帰的にファイルを監視しようとして無限ループに近いファイルアクセスが発生する。

---

### 🟡 原因4: `awaitWriteFinish.pollInterval: 100ms` による一定間隔ポーリング

`pollInterval: 100` (ms)は `awaitWriteFinish` が有効なときのみ機能するが、大量のファイルがある場合はこのポーリングがCPUを圧迫する可能性がある。

---

## プロセス終了できない理由

Ctrl+C でBunは停止するがNodeが残る根本原因：

1. Bunが起動した `vinxi dev` (Nodeプロセス) に **SIGINTが正しく伝播しない** — `bun x --bun vinxi dev` の場合、bunはプロキシとして動作し、子プロセスへのシグナル転送が不完全になる場合がある
2. Nodeプロセス内で `persistent: true` のchokidarウォッチャーが動き続けているため、SIGINTを受けてもイベントループが終了できない（graceful shutdownハンドラがない）
3. `JobWorker` が `setInterval` ベースのループを持っており、これも終了を阻害する可能性がある

---

## 再現条件の推測

「普通に動くときは動く」→「なんの差があって暴走するか不明」という点から：  
- **ローカルソースの登録有無**：ローカルメディアソースが登録されていないとchokidarは起動しない。監視ディレクトリ内のファイル数が多いと負荷が上がる
- **HMRが発火したタイミング**：packages/core or packages/ui のソースを変更した場合、ViteがHMRを発火してentry-server.tsxを再実行し、watcherが倍増する
- **packages/ui 分離のタイミング**：分離前はViteの監視対象が1パッケージ内のみ。分離後はワークスペース横断監視になり、symlink追跡で再帰的な監視が発生しやすくなった

---

## まとめ

| 優先度 | 原因 | 影響 |
|---|---|---|
| 🔴 高 | chokidar `persistent:true` + graceful shutdown なし | Ctrl+Cで終了できない |
| 🔴 高 | HMRによる `startMonitoringAll` 多重実行 | watcherが積算・CPU爆発 |
| 🔴 高 | packages/core・ui のソース直接参照によるVite監視範囲爆発 | Viteが大量のfsイベントを発火 |
| 🟡 中 | `pollInterval: 100ms` による定常的ポーリング | ファイル数が多いとCPU使用率が下がらない |

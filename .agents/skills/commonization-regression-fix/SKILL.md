---
name: commonization-regression-fix
description: "共通化（server-tauri-commonization）後に発生したランタイムエラー、型エラー、テスト失敗をパターン別に修正するためのスキル。デグレの種類を特定し、テンプレートに沿って修正を行う際に使用してください。"
---

# commonization-regression-fix

共通化作業（`apps/server` → `packages/*` への抽出）後に発生するデグレを、パターン別に修正するためのスキル。

## When to use

- `bun start` / `bun dev` でランタイムエラーが出たとき
- `bun run typecheck` で型エラーが出たとき
- `bun run test` が通らなくなったとき
- 共通化後に挙動が変わった報告を受けたとき
- `bun run build` 後の `.output` で動作がおかしいとき

## Source of truth

- 修正の前提は server 側の旧実装（`git show <commit>^:<path>`）とする
- 共通化の現状マップは `.indexion/wiki/server-tauri-parity.md` を参照する
- 上位ルールは repo root の `AGENTS.md` を優先する

## デグレパターン集

### Pattern 1: パス計算の参照先ミス

**症状:** サブディレクトリスキャン時に重複検出が失敗する、DB に保存されるパスが変わる

**原因:** shared package への抽出時、変数名を間違えて参照している

**検出方法:**
```bash
# 旧実装と比較
git log --oneline -- <対象ファイル>
git show <旧コミット>:<対象ファイル> | grep -A5 -B5 <問題の関数>
```

**修正テンプレート:**
```typescript
// ❌ Before (誤: sourceRootPath を使用)
const relativePath = this.pathAdapter.relative(sourceRootPath, file);

// ✅ After (正: directoryPath を使用 — 旧実装と同じ)
const relativePath = this.pathAdapter.relative(directoryPath, file);
```

**確認項目:**
- [ ] 旧実装で `path.relative()` の第1引数に何を使っていたか確認
- [ ] `queueProcessingJob` 等の後続処理にも正しいパスを渡しているか確認
- [ ] `registerExistingMedia` 等の scan 系メソッドは `directoryPath` と `sourceRootPath` の使い分けに注意

**過去の事例:** `packages/application/src/services/media-service.ts` の `registerExistingMedia`（#322）

---

### Pattern 2: Proxy の `has` トラップ欠如

**症状:** `"property" in obj` のチェックが `false` を返す。ランタイムで `does not support execute()` 等のエラー

**原因:** `new Proxy({}, { get })` で作成したオブジェクトは `in` 演算子が空オブジェクトに対して評価される

**検出方法:**
```bash
# Proxy 定義を探す
grep -rn "new Proxy({}" apps/server/src/
```

**修正テンプレート:**
```typescript
// ❌ Before (has トラップなし)
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = initializeDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// ✅ After (has トラップ追加)
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = initializeDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, prop) {
    const instance = initializeDb();
    return prop in instance;
  },
});
```

**確認項目:**
- [ ] `packages/db` の `withUniqueJobLock` 等で `hasTransaction` / `hasExecute` チェックがある箇所を確認
- [ ] Proxy オブジェクトを `DrizzleExecutor` 型として渡している箇所を確認

**過去の事例:** `apps/server/src/infrastructure/db/index.ts` の `db` Proxy（#322）

---

### Pattern 3: バンドル時の外部化漏れ

**症状:** `bun start`（ビルド済み `.output` 使用）では動くが `__dirname` やファイルパスが壊れる

**原因:** `ffmpeg-static` 等のパッケージは `__dirname` でバイナリを探すが、バンドル後は `__dirname` が `.output/` を指す

**検出方法:**
```bash
# バンドル後のパスを確認
node -e "const p = require('apps/server/.output/server/_libs/<package>.mjs'); console.log(p);"
# 実際のバイナリ存在確認
ls -la <バンドル後のパス>
```

**修正テンプレート:**
```typescript
// ❌ Before (import で直接取得 — バンドル後は壊れる)
import ffmpegPath from "ffmpeg-static";
const resolvedPath = ffmpegPath ?? undefined;

// ✅ After (ランタイムで存在確認してフォールバック)
async function resolvePath(): Promise<string | null> {
  const { existsSync } = await import("node:fs");
  try {
    const staticPath = (await import("ffmpeg-static")).default;
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch (_e) {}
  // システムのバイナリにフォールバック
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch (_e) {
    return null;
  }
}
```

**確認項目:**
- [ ] `import xxx from "ffmpeg-static"` 等のトップレベル import を探す
- [ ] バンドル後に `__dirname` を使うパッケージがないか確認
- [ ] `bun run build && bun start` でランタイム検証する

**過去の事例:** `apps/server/src/infrastructure/utils/ffmpeg.ts` と `download-jobs.ts`（#322）

---

### Pattern 4: wrapper のメソッド未露出

**症状:** shared service にあるメソッドが server wrapper から呼べない。oRPC router で 500 エラー

**原因:** shared package への抽出時に、新しく追加されたメソッドを wrapper に追加し忘れる

**検出方法:**
```bash
# shared service のメソッド一覧
grep -n "async \w\+" packages/application/src/services/<service>.ts
# server wrapper の露出メソッド一覧
grep -n "export const.*Service" apps/server/src/application/services/<service>.ts
```

**修正テンプレート:**
```typescript
// ❌ Before (3メソッドが未露出)
export const AuthorService = {
  list: authorService.list,
  get: authorService.get,
  create: authorService.create,
  update: ...,
  delete: authorService.delete,
};

// ✅ After (全メソッドを露出)
export const AuthorService = {
  list: authorService.list,
  get: authorService.get,
  create: authorService.create,
  update: ...,
  delete: authorService.delete,
  listForMedia: authorService.listForMedia,
  addToMedia: authorService.addToMedia,
  removeFromMedia: authorService.removeFromMedia,
};
```

**確認項目:**
- [ ] shared service の全メソッドが wrapper に露出しているか
- [ ] oRPC router が wrapper 経由でメソッドを呼んでいるか
- [ ] tauri 側の wrapper も同様に露出しているか

**過去の事例:** `apps/server/src/application/services/author-service.ts`（#322）

---

### Pattern 5: Zod `.default()` と型の不整合

**症状:** `typecheck` で `Type 'undefined' is not assignable to type 'xxx'` エラー

**原因:** Zod スキーマの `.default()` は `z.infer` 後に型を必須にするが、元のオプショナル型をそのまま代入している

**検出方法:**
```bash
bun run typecheck 2>&1 | grep "is not assignable to type"
```

**修正テンプレート:**
```typescript
// Zod スキーマ
const schema = z.object({
  order: z.enum(["asc", "desc"]).default("desc"),  // z.infer では "asc" | "desc" (必須)
  offset: z.number().default(0),                     // z.infer では number (必須)
});

// ❌ Before (オプショナルな値をそのまま代入)
return {
  order: options.order,     // "asc" | "desc" | undefined → 型エラー
  offset: options.offset,   // number | undefined → 型エラー
};

// ✅ After (デフォルト値をフォールバック)
return {
  order: options.order ?? "desc",
  offset: options.offset ?? 0,
};
```

**確認項目:**
- [ ] Zod `.default()` を使っているフィールドの `z.infer` 型を確認
- [ ] 元のオプショナル型からの代入時に `??` フォールバックを入れる
- [ ] `.optional().default(x)` と `.default(x)` の挙動の違いに注意

**過去の事例:** `packages/db/src/repositories/media-search.ts` の `buildSearchRequestFromOptions`（#322）

---

### Pattern 6: テストのモック型付け

**症状:** `typecheck` で `Property 'mockReset' does not exist on type` エラー。テストは通るが型エラー

**原因:** `vi.fn()` を `as unknown as Pick<Repo, "method">` でキャストすると、Mock メソッド（`mockReset`, `mockResolvedValue` 等）の型が失われる

**検出方法:**
```bash
bun run typecheck 2>&1 | grep "mockReset\|mockResolvedValue"
```

**修正テンプレート:**
```typescript
// ❌ Before (Mock メソッドが型で見えない)
const mockRepo = {
  findById: vi.fn(),
} as unknown as Pick<Repository, "findById">;

mockRepo.findById.mockReset(); // 型エラー

// ✅ After (Mock 型を保持するヘルパーを使用)
type MockedFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

const mockRepo = {
  findById: vi.fn(),
} as { findById: MockedFn<(id: string) => any> };

mockRepo.findById.mockReset(); // OK

// 使用時に型を合わせる
const result = await someFunction(
  mockRepo as Pick<Repository, "findById">, // 呼び出し側でキャスト
);
```

**確認項目:**
- [ ] `as unknown as` で Mock オブジェクトをキャストしている箇所を探す
- [ ] `MockedFn` ヘルパー型を定義して Mock メソッドを保持する
- [ ] 使用箇所（関数呼び出し時）で `as` キャストする

**過去の事例:** `packages/application/src/tests/ai-tagging-service.test.ts`（#322）

---

## 修正ワークフロー

1. **エラーの種類を特定する**
   - ランタイムエラー → Pattern 1, 2, 3
   - 型エラー → Pattern 5, 6
   - メソッド不在 → Pattern 4

2. **パターン集から該当パターンを探す**
   - エラーメッセージやスタックトレースから推定

3. **修正を適用する**
   - テンプレートの before/after を参考に修正

4. **検証する**
   ```bash
   bun run test          # テスト通過
   bun run typecheck     # 型エラーなし
   bun run build         # ビルド成功
   bun start             # ランタイム正常
   ```

5. **パターン集を更新する**
   - 新しいパターンが見つかった場合はこのファイルに追記する

## 予防チェックリスト

共通化のレビュー時に参照する簡易チェック項目:

- [ ] 旧実装の `path.relative()` / 変数参照先を確認したか
- [ ] Proxy オブジェクトに `has` トラップがあるか確認したか
- [ ] `__dirname` を使うパッケージは externalize されているか確認したか
- [ ] shared service の全メソッドが wrapper に露出しているか確認したか
- [ ] Zod `.default()` フィールドの代入時に `??` フォールバックを入れたか
- [ ] テストの Mock オブジェクトで `MockedFn` 型を使ったか
- [ ] `bun run build && bun start` でランタイム検証したか

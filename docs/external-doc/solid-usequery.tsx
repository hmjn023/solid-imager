import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/solid-query";
import { ErrorBoundary, Suspense } from "solid-js";

function App() {
  const repositoryQuery = useQuery(() => ({
    queryKey: ["TanStack Query"],
    queryFn: async () => {
      const result = await fetch("https://api.github.com/repos/TanStack/query");
      if (!result.ok) {
        throw new Error("データのフェッチに失敗しました");
      }
      return result.json();
    },
    staleTime: 1000 * 60 * 5, // 5分
    throwOnError: true, // クエリが失敗した場合にエラーをスローする
  }));

  return (
    <div>
      <div>静的コンテンツ</div>
      {/* フェッチ中にエラーが発生した場合、ErrorBoundaryによってキャッチされます */}
      <ErrorBoundary fallback={<div>何かがうまくいきませんでした！</div>}>
        {/* Suspenseは、データがフェッチされている間、ローディング状態をトリガーします */}
        <Suspense fallback={<div>ロード中...</div>}>
          {/* 
            クエリの `data` プロパティはSolidJSリソースであるため、
            Suspenseとトランジションでそのまま動作します！
          */}
          <div>{repositoryQuery.data?.updated_at}</div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

const root = document.getElementById("root");
const client = new QueryClient();

render(
  () => (
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  ),
  root!
);
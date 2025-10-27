import { useParams } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { isServer } from "solid-js/web";

// APIから返されるメディアオブジェクトの型を定義します。
// これはDBスキーマと一致することが期待されます。
type Media = {
  id: string;
  fileName: string;
  width: number;
  height: number;
  // 必要に応じて他のプロパティを追加します。
};

/**
 * 指定されたソースIDのメディアリストをAPIから非同期に取得します。
 * @param sourceId メディアを取得するソースのID。
 * @returns メディアの配列を解決するPromise。
 */
async function fetchMedia(sourceId: string): Promise<Media[]> {
  const url = `/api/sources/${sourceId}`;
  const fullUrl = isServer ? `http://localhost:3000${url}` : url;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    // TODO: エラーハンドリングを改善する
    throw new Error("メディアの取得に失敗しました");
  }
  return response.json();
}

/**
 * 特定のメディアソース内のメディアをグリッド表示するページコンポーネントです。
 */
export default function MediaListPage() {
  const params = useParams();
  const [media] = createResource(() => params.mediaSourceId, fetchMedia);

  return (
    <div class="container mx-auto p-4">
      <h1 class="mb-4 font-bold text-2xl">
        Media in Source: {params.mediaSourceId}
      </h1>

      <Show when={media.loading}>
        <div>Loading media...</div>
      </Show>

      <Show when={media.error}>
        <div class="text-red-500">Error: {media.error.message}</div>
      </Show>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <For each={media()}>
          {(item) => (
            <a href={`${params.mediaSourceId}/${item.id}`}>
              <div class="aspect-square overflow-hidden rounded-lg border">
                {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
                <img
                  alt={item.fileName}
                  class="h-full w-full object-cover"
                  height={item.height}
                  src={`/api/sources/${params.mediaSourceId}/${item.id}/thumbnail`}
                  width={item.width}
                />
              </div>
            </a>
          )}
        </For>
      </div>
    </div>
  );
}

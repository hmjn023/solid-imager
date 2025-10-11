import type { MediaSourceInfo, MediaSourceTypeEnum } from "~/lib/types";

const API_BASE_URL = "http://localhost:3000/api";

export type CreateSourceData = {
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: { path: string };
};

export type UpdateSourceData = CreateSourceData;

export const MediaSourceService = {
  // すべてのソースを取得します。
  async fetchSources(): Promise<MediaSourceInfo[]> {
    const response = await fetch(`${API_BASE_URL}/sources`);
    if (!response.ok) {
      throw new Error("Failed to fetch sources");
    }
    return response.json();
  },

  // 新しいソースを作成します。
  async createSource(sourceData: CreateSourceData): Promise<MediaSourceInfo> {
    const response = await fetch(`${API_BASE_URL}/sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sourceData),
    });
    if (!response.ok) {
      throw new Error("Failed to create source");
    }
    return response.json();
  },

  // 既存のソースを更新します。
  async updateSource(
    sourceId: string,
    sourceData: UpdateSourceData
  ): Promise<MediaSourceInfo> {
    const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sourceData),
    });
    if (!response.ok) {
      throw new Error("Failed to update source");
    }
    return response.json();
  },

  // ソースを削除します。
  async deleteSource(sourceId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete source");
    }
    return response.json();
  },
};

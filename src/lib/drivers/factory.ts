import type { MediaSource } from "~/db/schema";
import { localConnectionSchema } from "~/domain/media/schemas";
import { LocalDriver } from "./local";
import type { MediaSourceDriver } from "./types";

/**
 * 指定されたメディアソースのドライバーインスタンスを返します。
 * @param source - データベースからのメディアソース。
 * @returns MediaSourceDriverインターフェースを実装するクラスのインスタンス。
 * @throws メディアソースタイプが不明な場合、または接続情報が無効な場合にエラーをスローします。
 */
export function getDriver(source: MediaSource): MediaSourceDriver {
  switch (source.type) {
    case "local": {
      const connectionInfo = localConnectionSchema.parse(source.connectionInfo);
      return new LocalDriver(connectionInfo);
    }
    default:
      // ここで`source.type`は`never`であり、すべてのケースが処理されることを保証します。
      throw new Error(`メディアソースタイプが不明です: ${source.type}`);
  }
}

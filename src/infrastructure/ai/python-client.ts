import type { IAiClient } from "~/domain/interfaces/ai-client";
import {
  type CcipDifferenceResponse,
  type CcipFeatureResponse,
  ccipDifferenceResponseSchema,
  ccipFeatureResponseSchema,
  type TaggingResponse,
  taggingResponseSchema,
} from "~/domain/tagging/schemas";

export class PythonClient implements IAiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl = "http://localhost:8000", timeoutMs = 30_000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  updateConfig(config: { baseUrl: string; timeoutMs: number }) {
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private createAbortSignal(): AbortSignal {
    return AbortSignal.timeout(this.timeoutMs);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: this.createAbortSignal(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async tagImage(imageBuffer: ArrayBuffer): Promise<TaggingResponse> {
    const formData = new FormData();
    formData.append("file", new Blob([imageBuffer]), "image.jpg");

    const response = await fetch(`${this.baseUrl}/tag`, {
      method: "POST",
      body: formData,
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new Error(`Failed to tag image: ${response.statusText}`);
    }

    const data = await response.json();
    return taggingResponseSchema.parse(data);
  }

  async tagImageByPath(path: string): Promise<TaggingResponse> {
    const formData = new FormData();
    formData.append("path", path);

    const response = await fetch(`${this.baseUrl}/tag`, {
      method: "POST",
      body: formData,
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new Error(`Failed to tag image by path: ${response.statusText}`);
    }

    const data = await response.json();
    return taggingResponseSchema.parse(data);
  }

  async extractCcipFeature(
    imageBuffer: ArrayBuffer
  ): Promise<CcipFeatureResponse> {
    const formData = new FormData();
    formData.append("file", new Blob([imageBuffer]), "image.jpg");

    const response = await fetch(`${this.baseUrl}/ccip/feature`, {
      method: "POST",
      body: formData,
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new Error(`Failed to extract CCIP feature: ${response.statusText}`);
    }

    const data = await response.json();
    return ccipFeatureResponseSchema.parse(data);
  }

  async extractCcipFeatureByPath(path: string): Promise<CcipFeatureResponse> {
    const formData = new FormData();
    formData.append("path", path);

    const response = await fetch(`${this.baseUrl}/ccip/feature`, {
      method: "POST",
      body: formData,
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to extract CCIP feature by path: ${response.statusText}`
      );
    }

    const data = await response.json();
    return ccipFeatureResponseSchema.parse(data);
  }

  async calculateCcipDifference(
    feature1: number[],
    feature2: number[]
  ): Promise<CcipDifferenceResponse> {
    const response = await fetch(`${this.baseUrl}/ccip/difference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ feature1, feature2 }),
      signal: this.createAbortSignal(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to calculate CCIP difference: ${response.statusText}`
      );
    }

    const data = await response.json();
    return ccipDifferenceResponseSchema.parse(data);
  }
}

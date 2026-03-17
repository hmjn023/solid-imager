import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ServerConfigService } from "~/application/services/server-config-service";

vi.mock("node:fs");
vi.mock("node:fs/promises");

describe("ConfigService", () => {
  let service: ServerConfigService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    service = new ServerConfigService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("should load default config if file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    service.load();

    expect(service.getConfig()).toEqual(defaultAppConfig);
    // Should write defaults to disk
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("should load existing config from file", () => {
    const fileConfig = {
      ...defaultAppConfig,
      jobs: { ...defaultAppConfig.jobs, concurrency: 10 },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileConfig));

    service.load();

    expect(service.getConfig().jobs.concurrency).toBe(10);
  });

  it("should override config with environment variables", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.stubEnv("CONFIG_JOBS_CONCURRENCY", "50");

    service.load();

    // biome-ignore lint/style/noMagicNumbers: Test assertion
    expect(service.getConfig().jobs.concurrency).toBe(50);
  });

  it("should handle nested env overrides", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    // media.tagExtraction.comfyui.positiveNodeTypes
    vi.stubEnv(
      "CONFIG_MEDIA_TAGEXTRACTION_COMFYUI_POSITIVENODETYPES",
      '["TestNode"]'
    );

    service.load();

    expect(
      service.getConfig().media.tagExtraction.comfyui.positiveNodeTypes
    ).toEqual(["TestNode"]);
  });

  it("should ignore invalid env keys", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.stubEnv("CONFIG_INVALID_KEY", "value");

    service.load();

    // Should not throw and config should be default
    expect(service.getConfig()).toEqual(defaultAppConfig);
  });

  it("should update config and notify listeners", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    service.load();

    const listener = vi.fn();
    service.onChange(listener);

    // Partial update
    const UpdatedConcurrency = 5;
    await service.updateConfig({
      jobs: { concurrency: UpdatedConcurrency },
    } as any);
    const newConfig = service.getConfig();
    expect(newConfig.jobs.concurrency).toBe(UpdatedConcurrency);
    // Listener should receive full updated config
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: expect.objectContaining({ concurrency: 5 }),
      })
    );
    expect(fsPromises.writeFile).toHaveBeenCalled();
    expect(fsPromises.rename).toHaveBeenCalled();
  });

  it("should throw on invalid update", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    service.load();

    // Try setting invalid type (string for number)
    await expect(
      service.updateConfig({ jobs: { concurrency: "invalid" } } as any)
    ).rejects.toThrow();
  });
});

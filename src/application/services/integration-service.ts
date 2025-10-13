/**
 * IntegrationService - 外部連携機能
 * Feature 21: 外部連携機能
 */

export const IntegrationService = {
  // Feature 21: 外部連携機能
  uploadToComfyUi(_mediaId: string, _comfyUiUrl: string) {
    // TODO: Upload media to ComfyUI
    throw new Error("Not implemented");
  },

  getComfyUiWorkflows() {
    // TODO: Get available ComfyUI workflows
    throw new Error("Not implemented");
  },

  sendDiscordNotification(_message: string, _webhookUrl: string) {
    // TODO: Send notification to Discord webhook
    throw new Error("Not implemented");
  },
};

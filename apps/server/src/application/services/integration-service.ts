/**
 * IntegrationService - 外部連携機能
 * Feature 21: 外部連携機能
 */

/**
 * Provides services for external integrations, such as with ComfyUI and Discord.
 */
export const IntegrationService = {
  /**
   * Uploads a media item to a ComfyUI instance.
   * @param {string} _mediaId - The ID of the media item to upload.
   * @param {string} _comfyUiUrl - The URL of the ComfyUI instance.
   * @returns {any} Confirmation of the upload.
   */
  uploadToComfyUi(_mediaId: string, _comfyUiUrl: string) {
    // TODO: Upload media to ComfyUI
    throw new Error("Not implemented");
  },

  /**
   * Retrieves a list of available ComfyUI workflows.
   * @returns {any} A list of ComfyUI workflows.
   */
  getComfyUiWorkflows() {
    // TODO: Get available ComfyUI workflows
    throw new Error("Not implemented");
  },

  /**
   * Sends a notification to a Discord webhook.
   * @param {string} _message - The message content to send.
   * @param {string} _webhookUrl - The URL of the Discord webhook.
   * @returns {any} Confirmation of the notification being sent.
   */
  sendDiscordNotification(_message: string, _webhookUrl: string) {
    // TODO: Send notification to Discord webhook
    throw new Error("Not implemented");
  },
};

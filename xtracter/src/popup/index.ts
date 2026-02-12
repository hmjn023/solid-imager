import { getClient, testConnection } from "@ext/api";
import type { MediaSource, TweetMetadata } from "@ext/schema";

const apiUrlInput = document.getElementById("api-url") as HTMLInputElement;
const select = document.getElementById("source-select") as HTMLSelectElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
const bulkUploadBtn = document.getElementById(
  "bulk-upload-btn"
) as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;
const exportStatusDiv = document.getElementById(
  "export-status"
) as HTMLDivElement;
const uploadStatusDiv = document.getElementById(
  "upload-status"
) as HTMLDivElement;

const DEFAULT_API_URL = "http://localhost:3000/api/rpc";
const API_URL_DEBOUNCE_MS = 1000;
const STATUS_CLEAR_TIMEOUT_MS = 2000;
const EXPORT_STATUS_CLEAR_TIMEOUT_MS = 3000;

let isTestingConnection = false;

// Load saved setting and available sources
async function init() {
  try {
    // Load API URL first
    const settings = await chrome.storage.local.get([
      "selectedSourceId",
      "apiUrl",
    ]);
    // If settings.apiUrl is present, use it. Otherwise use DEFAULT_API_URL.
    const currentApiUrl = settings.apiUrl || DEFAULT_API_URL;
    apiUrlInput.value = currentApiUrl;
    const savedId = settings.selectedSourceId;
    statusDiv.textContent = "Loading sources...";
    statusDiv.className = "";

    // 1. Get Sources from Background (which fetches from API)
    const sources: MediaSource[] = await chrome.runtime.sendMessage({
      type: "GET_SOURCES",
    });

    // 3. Render Select Options
    select.innerHTML = "";
    if (!sources || sources.length === 0) {
      const option = document.createElement("option");
      option.text = "No sources found";
      select.add(option);
      statusDiv.textContent = "No sources found. Check API URL and server.";
      statusDiv.className = "error";
    } else {
      for (const source of sources) {
        const option = document.createElement("option");
        option.value = source.id;
        option.text = `${source.name} (${source.type})`;
        if (source.id === savedId) {
          option.selected = true;
        }
        select.add(option);
      }
      statusDiv.textContent = "";
      statusDiv.className = "";
    }

    select.disabled = false;
    saveBtn.disabled = false;
  } catch (error) {
    let errorMessage = "Error loading sources.";
    if (error instanceof Error) {
      errorMessage += ` ${error.message}`;
    }

    statusDiv.textContent = errorMessage;
    statusDiv.className = "error";

    // Enable save button so user can fix the URL
    saveBtn.disabled = false;
  }
}

// API URLが変更されたときに接続をテスト
async function handleApiUrlChange() {
  if (isTestingConnection) {
    return;
  }

  const newUrl = apiUrlInput.value.trim();
  if (!newUrl || newUrl === DEFAULT_API_URL) {
    return;
  }

  isTestingConnection = true;
  statusDiv.textContent = "Testing connection...";
  statusDiv.className = "";
  saveBtn.disabled = true;

  try {
    const result = await testConnection(newUrl);

    if (result.success) {
      statusDiv.textContent = "Connection successful!";
      statusDiv.className = "success";
      // ソースリストを再読み込み
      await init();
    } else {
      statusDiv.textContent = `Connection failed: ${result.error}`;
      statusDiv.className = "error";
    }
  } catch (_error) {
    statusDiv.textContent = "Connection test failed";
    statusDiv.className = "error";
  } finally {
    isTestingConnection = false;
    saveBtn.disabled = false;
  }
}

// API URL入力時のデバウンス処理
let urlChangeTimeout: number | null = null;
apiUrlInput.addEventListener("input", () => {
  if (urlChangeTimeout) {
    clearTimeout(urlChangeTimeout);
  }
  urlChangeTimeout = setTimeout(() => {
    handleApiUrlChange();
  }, API_URL_DEBOUNCE_MS) as unknown as number;
});

saveBtn.addEventListener("click", async () => {
  const selectedId = select.value;
  const apiUrl = apiUrlInput.value;

  await chrome.storage.local.set({
    selectedSourceId: selectedId,
    apiUrl,
  });

  statusDiv.textContent = "Saved!";
  statusDiv.className = "success";

  // Refresh list to verify connection
  await init();

  setTimeout(() => {
    statusDiv.textContent = "";
    statusDiv.className = "";
  }, STATUS_CLEAR_TIMEOUT_MS);
});

exportBtn.addEventListener("click", async () => {
  try {
    exportStatusDiv.textContent = "Requesting data...";
    // Send message to Background to trigger JSON download from active tab
    await chrome.runtime.sendMessage({ type: "DOWNLOAD_JSON_FROM_POPUP" });
    exportStatusDiv.textContent = "Download started!";
    exportStatusDiv.className = "success";
    setTimeout(() => {
      exportStatusDiv.textContent = "";
      exportStatusDiv.className = "";
    }, EXPORT_STATUS_CLEAR_TIMEOUT_MS);
  } catch (_error) {
    exportStatusDiv.textContent = "Failed. Are you on X.com?";
    exportStatusDiv.className = "error";
  }
});

bulkUploadBtn.addEventListener("click", async () => {
  try {
    uploadStatusDiv.textContent = "Fetching metadata...";
    uploadStatusDiv.className = "";

    // 1. Get Metadata from Active Tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      throw new Error("No active tab found");
    }

    const metadata = await new Promise<TweetMetadata[]>((resolve, reject) => {
      if (activeTab.id === undefined) {
        reject(new Error("Active tab ID is missing"));
        return;
      }
      chrome.tabs.sendMessage(
        activeTab.id,
        { type: "GET_METADATA" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response || []);
          }
        }
      );
    });

    if (!metadata || metadata.length === 0) {
      uploadStatusDiv.textContent = "No media found on this page.";
      uploadStatusDiv.className = "error";
      return;
    }

    uploadStatusDiv.textContent = `Uploading ${metadata.length} items...`;

    // 2. Call API
    const client = await getClient();
    const result = await client.imports.bulkAdd({
      items: metadata,
    });

    uploadStatusDiv.textContent = `Uploaded! Added: ${result.addedCount}, Skipped: ${result.skippedCount}`;
    uploadStatusDiv.className = "success";
  } catch (error) {
    let msg = "Upload failed.";
    if (error instanceof Error) {
      msg += ` ${error.message}`;
    }
    uploadStatusDiv.textContent = msg;
    uploadStatusDiv.className = "error";
  }
});

init();

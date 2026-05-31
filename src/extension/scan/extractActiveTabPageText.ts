import { extractTextFromCurrentDocument } from "../content/jobPageTextExtractor";
import type { JobPageExtractedText } from "../content/jobPageTextExtractor";

export type ActiveTabText = JobPageExtractedText;

export type ExtractActiveTabPageTextOptions = {
  tabId?: number;
};

const SCAN_MAX_ATTEMPTS = 3;
const SCAN_RETRY_DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function resolveTargetTabId(preferredTabId?: number): Promise<number> {
  if (preferredTabId !== undefined && Number.isFinite(preferredTabId)) {
    return preferredTabId;
  }

  const [activeTab] = await globalThis.chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    throw new Error("No active tab was found.");
  }

  return activeTab.id;
}

function isRestrictedTabUrl(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (
      protocol === "chrome:" ||
      protocol === "chrome-devtools:" ||
      protocol === "devtools:" ||
      protocol === "edge:"
    ) {
      return true;
    }
    const host = parsed.hostname.toLowerCase();
    return host === "chrome.google.com" || host === "chromewebstore.google.com";
  } catch {
    return true;
  }
}

function isActiveTabText(value: unknown): value is ActiveTabText {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.url === "string" &&
    typeof record.text === "string" &&
    typeof record.debugLog === "string"
  );
}

/**
 * One-shot scan: Chrome serializes `extractTextFromCurrentDocument` into the tab.
 * No pre-injected content script, no `tabs.sendMessage` (avoids "message port closed").
 */
async function extractViaExecuteScript(tabId: number): Promise<ActiveTabText> {
  const [injectionResult] = await globalThis.chrome.scripting
    .executeScript({
      target: { tabId },
      injectImmediately: true,
      func: extractTextFromCurrentDocument,
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown script error.";
      throw new Error(`Could not run scan on this page: ${message}`);
    });

  const result = injectionResult?.result;
  if (!isActiveTabText(result)) {
    throw new Error("Could not read text from the active tab.");
  }

  return result;
}

export async function extractActiveTabPageText(
  options: ExtractActiveTabPageTextOptions = {},
): Promise<ActiveTabText> {
  if (!globalThis.chrome?.tabs || !globalThis.chrome.scripting) {
    throw new Error("Chrome extension APIs are not available.");
  }

  const tabId = await resolveTargetTabId(options.tabId);
  const tab = await globalThis.chrome.tabs.get(tabId);

  if (isRestrictedTabUrl(tab.url)) {
    throw new Error(
      "Cannot scan this page. Open a job posting in a normal browser tab, then try again.",
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= SCAN_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await sleep(SCAN_RETRY_DELAY_MS * attempt);
    }

    try {
      return await extractViaExecuteScript(tabId);
    } catch (error) {
      lastError = error;
    }
  }

  const lastMessage =
    lastError instanceof Error ? lastError.message : "Unknown error.";

  if (
    lastMessage.includes("Cannot access contents") ||
    lastMessage.includes("host") ||
    lastMessage.includes("Cannot access a chrome://")
  ) {
    const accessError = new Error(
      "Cannot read this job page. Reload the posting, click the Resume Tailor toolbar icon on that tab, then scan again.",
    );
    (accessError as Error & { cause?: unknown }).cause = lastError;
    throw accessError;
  }

  const readError = new Error(
    `Could not read text from the active tab: ${lastMessage}`,
  );
  (readError as Error & { cause?: unknown }).cause = lastError;
  throw readError;
}

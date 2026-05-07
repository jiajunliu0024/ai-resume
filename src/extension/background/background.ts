/**
 * Must match `src/shared/floatingWidgetMessages.ts` (keep background a single rollup entry).
 */
const RESUME_TAILOR_MINIMIZE_PANEL = "RESUME_TAILOR_MINIMIZE_PANEL";

/**
 * `chrome.scripting.executeScript` throws (e.g. "Cannot access a chrome:// URL") on internal
 * browser pages and the Web Store. Skip early so the action handler does not reject uncaught.
 */
function canInjectScriptIntoTab(tab: chrome.tabs.Tab): boolean {
  const raw = tab.url ?? tab.pendingUrl;
  if (!raw) {
    return false;
  }
  try {
    const u = new URL(raw);
    const protocol = u.protocol.toLowerCase();
    if (
      protocol === "chrome:" ||
      protocol === "chrome-devtools:" ||
      protocol === "devtools:" ||
      protocol === "edge:"
    ) {
      return false;
    }
    const host = u.hostname.toLowerCase();
    if (host === "chrome.google.com" || host === "chromewebstore.google.com") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The app iframe cannot always reach the injected widget via window.postMessage on some sites.
 * The iframe sends this to the service worker, which forwards to the tab's content script.
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== RESUME_TAILOR_MINIMIZE_PANEL) {
    return;
  }

  const tabIdFromMessage =
    typeof message.tabId === "number" && Number.isFinite(message.tabId) ?
      message.tabId
    : undefined;
  /** Prefer explicit id from the floating iframe URL; `sender.tab` can be missing or stale in MV3. */
  const tabId = tabIdFromMessage ?? sender.tab?.id;
  if (tabId === undefined) {
    return;
  }

  void chrome.tabs.sendMessage(tabId, { type: RESUME_TAILOR_MINIMIZE_PANEL }).catch(() => {
    // Content script may not be loaded; user can toggle the widget again.
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  if (!canInjectScriptIntoTab(tab)) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "RESUME_TAILOR_TOGGLE_WIDGET",
    });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (hostTabId: number) => {
          (
            window as unknown as {
              __resumeTailorHostTabId?: number;
            }
          ).__resumeTailorHostTabId = hostTabId;
        },
        args: [tab.id],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["assets/floatingWidget.js"],
      });
    } catch {
      // Restricted URL edge cases or transient injection failure.
    }
  }
});
export {};

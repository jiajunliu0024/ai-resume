import { RESUME_TAILOR_READ_ACTIVE_TAB_TEXT } from "../../shared/floatingWidgetMessages";
import type { ActiveTabText } from "../scan/extractActiveTabPageText";

export type { ActiveTabText } from "../scan/extractActiveTabPageText";

export type ReadActiveTabTextOptions = {
  /** When the UI runs in the floating iframe, pass the host job tab id from the URL. */
  tabId?: number;
};

type ReadActiveTabResponse =
  | { ok: true; data: ActiveTabText }
  | { ok: false; error: string };

function getChromeRuntimeErrorMessage(): string | undefined {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.lastError) {
    return undefined;
  }
  return runtime.lastError.message;
}

/**
 * Reads JD text from the job tab via the service worker.
 * The background script runs `executeScript` and returns the result (no fragile `tabs.sendMessage` from the app iframe).
 */
export async function readActiveTabText(
  options: ReadActiveTabTextOptions = {},
): Promise<ActiveTabText> {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    throw new Error("Chrome extension APIs are not available.");
  }

  return new Promise((resolve, reject) => {
    globalThis.chrome.runtime.sendMessage(
      {
        type: RESUME_TAILOR_READ_ACTIVE_TAB_TEXT,
        tabId: options.tabId,
      },
      (response: ReadActiveTabResponse | undefined) => {
        const runtimeError = getChromeRuntimeErrorMessage();
        if (runtimeError) {
          reject(new Error(runtimeError));
          return;
        }

        if (!response) {
          reject(new Error("No response from the extension background."));
          return;
        }

        if (!response.ok) {
          reject(new Error(response.error || "Could not read the active tab."));
          return;
        }

        resolve(response.data);
      },
    );
  });
}

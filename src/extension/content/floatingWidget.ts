/**
 * Injected via `chrome.scripting.executeScript` as a single file. Do not import other modules
 * here — Vite would emit extra chunks and top-level `import`, which breaks injection on many pages.
 * Keep in sync with `src/shared/floatingWidgetMessages.ts`.
 */
const RESUME_TAILOR_MINIMIZE_PANEL = "RESUME_TAILOR_MINIMIZE_PANEL" as const;
const RESUME_TAILOR_GET_HOST_TAB_ID = "RESUME_TAILOR_GET_HOST_TAB_ID" as const;
const RESUME_TAILOR_PANEL_OPEN_KEY = "resume-tailor.panel-open";

const widgetRootId = "resume-tailor-floating-widget";

let detachFloatingWidgetMessageListener: (() => void) | null = null;
let detachRuntimeMessageListener: (() => void) | null = null;

type WidgetController = {
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
};

let widgetController: WidgetController | null = null;

function persistPanelOpen(isOpen: boolean) {
  try {
    if (isOpen) {
      sessionStorage.setItem(RESUME_TAILOR_PANEL_OPEN_KEY, "1");
    } else {
      sessionStorage.removeItem(RESUME_TAILOR_PANEL_OPEN_KEY);
    }
  } catch {
    // sessionStorage may be unavailable on some restricted pages.
  }
}

function wasPanelOpen(): boolean {
  try {
    return sessionStorage.getItem(RESUME_TAILOR_PANEL_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function resolveHostTabId(): Promise<number | undefined> {
  const w = window as Window & { __resumeTailorHostTabId?: unknown };
  const injected = w.__resumeTailorHostTabId;
  if (typeof injected === "number" && Number.isFinite(injected)) {
    return Promise.resolve(injected);
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: RESUME_TAILOR_GET_HOST_TAB_ID }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      const tabId = (response as { tabId?: number } | undefined)?.tabId;
      resolve(typeof tabId === "number" && Number.isFinite(tabId) ? tabId : undefined);
    });
  });
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement("style");

  style.textContent = `
    :host {
      /* Avoid \`all: initial\` alone — it resets \`display\` to \`inline\` and can break layout/stacking. */
      display: block;
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }

    .launcher {
      position: fixed;
      /* Same vertical band as the in-app step row (parallel when collapsed vs open). */
      top: 127px;
      right: 0;
      left: auto;
      z-index: 2147483647;
      display: grid;
      width: 60px;
      height: 60px;
      place-items: center;
      border: 0;
      border-radius: 16px 0 0 16px;
      color: #ffffff;
      background: #073391;
      box-shadow: 0 14px 34px rgb(7 51 145 / 26%);
      cursor: pointer;
      transform: translateY(-50%);
    }

    .launcher:hover {
      background: #062c78;
    }

    .launcher:focus-visible {
      outline: 2px solid #2fb8d4;
      outline-offset: 2px;
    }

    .launcher-mark {
      font-size: 28px;
      font-weight: 900;
      line-height: 1;
      transform: rotate(-28deg);
    }

    /* Wraps the left “R” tab + panel so the tab can sit outside the iframe without clipping. */
    .panel-cluster {
      position: fixed;
      top: 40px;
      bottom: 40px;
      right: 12px;
      z-index: 2147483647;
      display: flex;
      flex-direction: row;
      /* Stretch the panel to full viewport band height; only the tab overrides below. */
      align-items: stretch;
      gap: 0;
      max-width: calc(100vw - 24px);
      pointer-events: none;
    }

    .panel-cluster > * {
      pointer-events: auto;
    }

    .panel-cluster[hidden] {
      display: none !important;
    }

    /*
      Vertical alignment with the Scan/Resume/Tailor/Letter row inside the iframe (~87px from
      iframe top). Tab height 44px → margin-top ≈ 65px centers the tab on that band.
    */
    .panel-collapse-tab {
      flex-shrink: 0;
      align-self: flex-start;
      width: 44px;
      height: 44px;
      margin-top: 65px;
      padding: 0;
      border: 0;
      border-radius: 12px 0 0 12px;
      display: grid;
      place-items: center;
      color: #ffffff;
      background: #073391;
      box-shadow: 0 10px 26px rgb(7 51 145 / 24%);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .panel-collapse-tab:hover {
      background: #062c78;
    }

    .panel-collapse-tab:focus-visible {
      outline: 2px solid #2fb8d4;
      outline-offset: 2px;
    }

    .panel-collapse-tab-mark {
      font-size: 22px;
      font-weight: 900;
      line-height: 1;
      transform: rotate(-28deg);
      user-select: none;
    }

    .panel {
      flex: 0 0 auto;
      align-self: stretch;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      width: min(372px, calc(100vw - 24px - 44px));
      overflow: hidden;
      border: 1px solid #e3e7f0;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 20px 50px rgb(16 24 40 / 22%);
    }

    .launcher[hidden] {
      display: none !important;
    }

    .panel-shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .panel-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
      position: relative;
      isolation: isolate;
    }

    .app-frame {
      position: relative;
      z-index: 0;
      flex: 1;
      width: 100%;
      min-height: 0;
      border: 0;
      background: #f7f9fe;
    }
  `;

  return style;
}

function registerRuntimeListeners(
  togglePanel: () => void,
  closePanel: (event?: Event) => void,
) {
  detachRuntimeMessageListener?.();
  detachRuntimeMessageListener = null;

  function onRuntimeMessage(message: unknown) {
    if (!message || typeof message !== "object") {
      return;
    }
    const m = message as { type?: string };
    if (m.type === "RESUME_TAILOR_TOGGLE_WIDGET") {
      togglePanel();
      return;
    }
    if (m.type === RESUME_TAILOR_MINIMIZE_PANEL) {
      closePanel();
    }
  }

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  detachRuntimeMessageListener = () => {
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  };
}

function createWidget(): WidgetController {
  detachFloatingWidgetMessageListener?.();
  detachFloatingWidgetMessageListener = null;
  detachRuntimeMessageListener?.();
  detachRuntimeMessageListener = null;
  document.getElementById(widgetRootId)?.remove();

  const host = document.createElement("div");
  host.id = widgetRootId;

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = createStyles();
  const launcher = document.createElement("button");
  const panelCluster = document.createElement("div");
  const collapseTab = document.createElement("button");
  const panel = document.createElement("section");

  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Resume Tailor");
  launcher.innerHTML = `<span class="launcher-mark">R</span>`;

  panelCluster.className = "panel-cluster";
  panelCluster.hidden = true;

  collapseTab.className = "panel-collapse-tab";
  collapseTab.type = "button";
  collapseTab.setAttribute("aria-label", "Hide Resume Tailor panel");
  collapseTab.setAttribute("title", "Hide panel");
  collapseTab.innerHTML = `<span class="panel-collapse-tab-mark">R</span>`;

  panel.className = "panel";
  launcher.hidden = false;

  panelCluster.append(collapseTab, panel);

  function openPanel() {
    panelCluster.hidden = false;
    launcher.hidden = true;
    panelCluster.style.removeProperty("display");
    launcher.style.removeProperty("display");
    persistPanelOpen(true);
  }

  function closePanel(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    panelCluster.hidden = true;
    launcher.hidden = false;
    panelCluster.style.setProperty("display", "none", "important");
    launcher.style.removeProperty("display");
    persistPanelOpen(false);
  }

  function togglePanel() {
    if (panelCluster.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  }

  launcher.addEventListener("click", () => {
    openPanel();
  });

  function minimizeFromCollapseTab(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    closePanel(event);
  }

  collapseTab.addEventListener("pointerdown", minimizeFromCollapseTab, true);
  collapseTab.addEventListener("click", minimizeFromCollapseTab, true);

  shadowRoot.append(style, launcher, panelCluster);
  document.documentElement.append(host);

  const extensionOrigin = new URL(chrome.runtime.getURL("/")).origin;

  function finishMount(appUrlHref: string) {
    detachFloatingWidgetMessageListener?.();
    detachFloatingWidgetMessageListener = null;
    detachRuntimeMessageListener?.();
    detachRuntimeMessageListener = null;

    panel.innerHTML = `
      <div class="panel-shell">
        <div class="panel-body">
          <iframe
            class="app-frame"
            title="Resume Tailor"
            src="${appUrlHref}"
          ></iframe>
        </div>
      </div>
    `;

    const appFrame = panel.querySelector("iframe.app-frame");
    if (!(appFrame instanceof HTMLIFrameElement)) {
      throw new Error("resume-tailor-floating-widget: app iframe not found");
    }

    function onWindowMessage(event: MessageEvent) {
      if (event.origin !== extensionOrigin) {
        return;
      }
      if (event.data?.type !== RESUME_TAILOR_MINIMIZE_PANEL) {
        return;
      }
      /** Do not require event.source === iframe window; some builds report an unexpected source. */
      closePanel();
    }

    window.addEventListener("message", onWindowMessage, true);
    detachFloatingWidgetMessageListener = () => {
      window.removeEventListener("message", onWindowMessage, true);
    };

    registerRuntimeListeners(togglePanel, closePanel);

    if (wasPanelOpen()) {
      openPanel();
    }
  }

  void (async () => {
    const appUrl = new URL(chrome.runtime.getURL("index.html"));
    appUrl.searchParams.set("embed", "floating-widget");

    const hostTabId = await resolveHostTabId();
    if (hostTabId !== undefined) {
      appUrl.searchParams.set("hostTabId", String(hostTabId));
    }

    finishMount(appUrl.href);
  })();

  return {
    openPanel,
    closePanel,
    togglePanel,
  };
}

function initFloatingWidget() {
  if (widgetController || document.getElementById(widgetRootId)) {
    return;
  }

  widgetController = createWidget();
}

initFloatingWidget();
export {};

/**
 * Injected via `chrome.scripting.executeScript` as a single file. Do not import other modules
 * here — Vite would emit extra chunks and top-level `import`, which breaks injection on many pages.
 * Keep in sync with `src/shared/floatingWidgetMessages.ts`.
 */
const RESUME_TAILOR_MINIMIZE_PANEL = "RESUME_TAILOR_MINIMIZE_PANEL" as const;

const widgetRootId = "resume-tailor-floating-widget";

let detachFloatingWidgetMessageListener: (() => void) | null = null;

function createStyles(): HTMLStyleElement {
  const style = document.createElement("style");

  style.textContent = `
    :host {
      all: initial;
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .launcher {
      position: fixed;
      top: 50%;
      right: 0;
      z-index: 2147483647;
      display: grid;
      width: 72px;
      height: 72px;
      place-items: center;
      border: 0;
      border-radius: 16px 0 0 16px;
      color: #ffffff;
      background: #2fb8d4;
      box-shadow: 0 14px 34px rgb(16 24 40 / 24%);
      cursor: pointer;
      transform: translateY(-50%);
    }

    .launcher-mark {
      font-size: 34px;
      font-weight: 900;
      line-height: 1;
      transform: rotate(-28deg);
    }

    .panel {
      position: fixed;
      top: 40px;
      bottom: 40px;
      right: 12px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      width: 360px;
      max-width: calc(100vw - 24px);
      overflow: hidden;
      border: 1px solid #e3e7f0;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 20px 50px rgb(16 24 40 / 22%);
    }

    .app-frame {
      position: relative;
      z-index: 1;
      flex: 1;
      width: 100%;
      min-height: 0;
      border: 0;
      background: #f7f9fe;
    }
  `;

  return style;
}

function createWidget() {
  detachFloatingWidgetMessageListener?.();
  detachFloatingWidgetMessageListener = null;
  document.getElementById(widgetRootId)?.remove();

  const host = document.createElement("div");
  host.id = widgetRootId;

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = createStyles();
  const launcher = document.createElement("button");
  const panel = document.createElement("section");

  const appUrl = new URL(chrome.runtime.getURL("index.html"));
  appUrl.searchParams.set("embed", "floating-widget");

  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Resume Tailor");
  launcher.innerHTML = `<span class="launcher-mark">R</span>`;

  panel.className = "panel";
  panel.innerHTML = `
    <iframe
      class="app-frame"
      title="Resume Tailor"
      src="${appUrl.href}"
    ></iframe>
  `;

  panel.hidden = true;
  launcher.hidden = false;

  function openPanel() {
    panel.hidden = false;
    launcher.hidden = true;
  }

  function closePanel(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    panel.hidden = true;
    launcher.hidden = false;
  }

  launcher.addEventListener("click", () => {
    openPanel();
  });

  const appFrame = panel.querySelector("iframe.app-frame");
  if (!(appFrame instanceof HTMLIFrameElement)) {
    throw new Error("resume-tailor-floating-widget: app iframe not found");
  }
  const appIframe: HTMLIFrameElement = appFrame;

  const extensionOrigin = new URL(chrome.runtime.getURL("/")).origin;

  function onWindowMessage(event: MessageEvent) {
    if (event.source !== appIframe.contentWindow) {
      return;
    }
    if (event.origin !== extensionOrigin) {
      return;
    }
    if (event.data?.type !== RESUME_TAILOR_MINIMIZE_PANEL) {
      return;
    }
    closePanel();
  }

  window.addEventListener("message", onWindowMessage);
  detachFloatingWidgetMessageListener = () => {
    window.removeEventListener("message", onWindowMessage);
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "RESUME_TAILOR_TOGGLE_WIDGET") {
      return;
    }

    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  shadowRoot.append(style, launcher, panel);
  document.documentElement.append(host);
}

createWidget();

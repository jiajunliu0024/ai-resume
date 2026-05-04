const widgetRootId = "resume-tailor-floating-widget";

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

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid #eef2f7;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #172033;
      font-size: 20px;
      font-weight: 800;
    }

    .brand-mark {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border-radius: 8px;
      color: #ffffff;
      background: #2fb8d4;
      font-size: 18px;
      font-weight: 900;
      transform: rotate(-28deg);
    }

    .close-button {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      border: 0;
      border-radius: 999px;
      color: #667085;
      background: transparent;
      font-size: 24px;
      cursor: pointer;
    }

    .close-button:hover {
      background: #f2f4f7;
    }

    .app-frame {
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
  document.getElementById(widgetRootId)?.remove();

  const host = document.createElement("div");
  host.id = widgetRootId;

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = createStyles();
  const launcher = document.createElement("button");
  const panel = document.createElement("section");

  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Resume Tailor");
  launcher.innerHTML = `<span class="launcher-mark">R</span>`;

  panel.className = "panel";
  panel.innerHTML = `
    <header class="header">
      <div class="brand">
        <span class="brand-mark">R</span>
        <span>Resume Tailor</span>
      </div>
      <button class="close-button" type="button" aria-label="Close Resume Tailor">×</button>
    </header>
    <iframe
      class="app-frame"
      title="Resume Tailor"
      src="${chrome.runtime.getURL("index.html")}"
    ></iframe>
  `;

  launcher.hidden = true;

  launcher.addEventListener("click", () => {
    panel.hidden = false;
    launcher.hidden = true;
  });

  panel.querySelector(".close-button")?.addEventListener("click", () => {
    panel.hidden = true;
    launcher.hidden = false;
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "RESUME_TAILOR_TOGGLE_WIDGET") {
      return;
    }

    const shouldOpen = panel.hidden;

    panel.hidden = !shouldOpen;
    launcher.hidden = shouldOpen;
  });

  shadowRoot.append(style, launcher, panel);
  document.documentElement.append(host);
}

createWidget();

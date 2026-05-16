export type ExtractedPageText = {
  title: string;
  url: string;
  text: string;
};

function readScanBodyText(body: HTMLElement): string {
  const candidate = Reflect.get(body, "innerText");
  return typeof candidate === "string"
    ? candidate
    : (body.textContent ?? "");
}

/** Snapshot of textual page content readable from the tab (Chrome `document` API). */
export function extractPageText(): ExtractedPageText {
  return {
    title: document.title,
    url: window.location.href,
    text: document.body ? readScanBodyText(document.body).trim() : "",
  };
}

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

let configured = false;

export function ensurePdfJsWorker(): void {
  if (configured) {
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  configured = true;
}

export { pdfjsLib };

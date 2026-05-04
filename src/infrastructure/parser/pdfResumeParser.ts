import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function isTextItem(item: unknown): item is { str: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string"
  );
}

function normalizePdfText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const textItems: string[] = [];

    textContent.items.forEach((item) => {
      if (isTextItem(item)) {
        textItems.push(item.str);
      }
    });

    const pageText = textItems.join(" ");

    pageTexts.push(pageText);
  }

  return normalizePdfText(pageTexts.join("\n\n"));
}

export type RenderPdfPageImageOptions = {
  maxPages?: number;
  maxWidthPx?: number;
  mimeType?: "image/png" | "image/jpeg";
  jpegQuality?: number;
};

/**
 * Renders PDF pages to data URLs for multimodal AI (visual layout preserved).
 * Runs in the browser; requires DOM canvas.
 */
export async function renderPdfPagesToImageDataUrls(
  file: File,
  options?: RenderPdfPageImageOptions,
): Promise<string[]> {
  const maxPages = options?.maxPages ?? 12;
  const maxWidthPx = options?.maxWidthPx ?? 1280;
  const mimeType = options?.mimeType ?? "image/jpeg";
  const jpegQuality = options?.jpegQuality ?? 0.9;
  const arrayBuffer = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;
  const pageCount = Math.min(pdfDocument.numPages, maxPages);
  const dataUrls: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidthPx / baseViewport.width, 2.25);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create canvas for PDF rendering.");
    }

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      canvas,
    });

    await renderTask.promise;

    if (mimeType === "image/png") {
      dataUrls.push(canvas.toDataURL("image/png"));
    } else {
      dataUrls.push(canvas.toDataURL("image/jpeg", jpegQuality));
    }
  }

  return dataUrls;
}

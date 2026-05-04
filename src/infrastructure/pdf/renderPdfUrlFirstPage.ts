import { ensurePdfJsWorker, pdfjsLib } from "./pdfjsSetup";

ensurePdfJsWorker();

/**
 * Renders the first page of a PDF (e.g. bundled template URL) onto a canvas.
 * Prefer this over an iframe inside extension pages — iframe PDF viewing is often blocked or flaky under MV3 CSP.
 */
export async function renderPdfUrlFirstPageToCanvas(
  pdfUrl: string,
  canvas: HTMLCanvasElement,
  maxCssWidth: number,
): Promise<{ destroy: () => Promise<void> }> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(
      `Could not load PDF (${response.status}). Add the file under public/resume-templates/, run npm run build, and reload the extension.`,
    );
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const document = await pdfjsLib.getDocument({ data }).promise;
  const page = await document.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxCssWidth / baseViewport.width, 1.75);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    await document.destroy();
    throw new Error("Canvas 2D context unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvas,
    viewport,
  });

  await renderTask.promise;

  return {
    destroy: async () => {
      await document.destroy();
    },
  };
}

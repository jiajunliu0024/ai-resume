import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  BUNDLED_RESUME_TEMPLATES,
  bundledResumeTemplatePdfUrl,
  isBundledResumeTemplateId,
  type BundledResumeTemplate,
  type BundledResumeTemplateId,
} from "../../infrastructure/pdf/bundledResumeTemplates";
import { renderPdfUrlFirstPageToCanvas } from "../../infrastructure/pdf/renderPdfUrlFirstPage";

type TailorResumePdfPreviewModalProps = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_BUNDLED: BundledResumeTemplateId = BUNDLED_RESUME_TEMPLATES[0]?.id ?? "tammy-resume";

export function TailorResumePdfPreviewModal({ open, onClose }: TailorResumePdfPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const destroyRef = useRef<(() => Promise<void>) | null>(null);

  const [bundledTemplateId, setBundledTemplateId] =
    useState<BundledResumeTemplateId>(DEFAULT_BUNDLED);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bundledMeta = BUNDLED_RESUME_TEMPLATES.find((item) => item.id === bundledTemplateId);
  const staticPreviewUrl = bundledMeta ? bundledResumeTemplatePdfUrl(bundledMeta.pdfPath) : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !staticPreviewUrl) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      if (destroyRef.current) {
        await destroyRef.current();
        destroyRef.current = null;
      }

      setStatus("loading");
      setErrorMessage(null);

      const maxWidth = Math.max(320, (frame?.clientWidth ?? 600) - 8);

      try {
        const { destroy } = await renderPdfUrlFirstPageToCanvas(staticPreviewUrl, canvas, maxWidth);
        if (cancelled) {
          await destroy();
          return;
        }

        destroyRef.current = () => destroy();
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Could not render this PDF in the extension.";
        setErrorMessage(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (destroyRef.current) {
        void destroyRef.current();
        destroyRef.current = null;
      }
    };
  }, [open, bundledTemplateId, staticPreviewUrl]);

  function handleDialogClose() {
    onClose();
  }

  function handleBundledChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (isBundledResumeTemplateId(next)) {
      setBundledTemplateId(next);
    }
  }

  async function downloadBundledTemplate(item: BundledResumeTemplate) {
    const url = bundledResumeTemplatePdfUrl(item.pdfPath);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.downloadFileName;
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="tailor-pdf-preview-dialog"
      onClose={handleDialogClose}
    >
      <div className="tailor-pdf-preview-panel">
        <header className="tailor-pdf-preview-header">
          <div>
            <h2 className="tailor-pdf-preview-title">Preview résumé template (PDF)</h2>
            <p className="helper-text tailor-pdf-preview-sub">
              First page is drawn with <strong>pdf.js</strong> (already in this project) so preview
              works inside the extension. Put PDFs in <code>public/resume-templates/</code>, rebuild,
              and reload — no extra npm package is required for this preview path.
            </p>
          </div>
          <button
            type="button"
            className="icon-only-button"
            aria-label="Close preview"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>

        <div className="tailor-pdf-preview-toolbar">
          <label className="field-label" htmlFor="tailor-pdf-bundled">
            Template file
          </label>
          <select
            id="tailor-pdf-bundled"
            className="text-input tailor-pdf-template-select"
            value={bundledTemplateId}
            onChange={handleBundledChange}
          >
            {BUNDLED_RESUME_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <p className="helper-text tailor-pdf-template-hint">
            Filenames are listed in <code>public/resume-templates/README.md</code>. If you only see
            README in that folder, copy your real PDFs and rename them to match before building.
          </p>
        </div>

        <div ref={frameRef} className="tailor-pdf-preview-frame-wrap tailor-pdf-preview-canvas-wrap">
          {status === "loading" ? (
            <div className="tailor-pdf-preview-loading">
              <span className="tailor-rewriter-spinner" aria-hidden="true" />
              <span>Loading PDF…</span>
            </div>
          ) : null}
          {status === "error" ? (
            <p className="error-text tailor-pdf-preview-error">{errorMessage}</p>
          ) : null}
          <canvas ref={canvasRef} className="tailor-pdf-preview-canvas" />
        </div>

        <footer className="tailor-pdf-preview-footer">
          <button
            type="button"
            className="button primary tailor-pdf-download"
            disabled={!bundledMeta}
            onClick={() => {
              if (bundledMeta) {
                void downloadBundledTemplate(bundledMeta);
              }
            }}
          >
            Download template PDF
          </button>
        </footer>
      </div>
    </dialog>
  );
}

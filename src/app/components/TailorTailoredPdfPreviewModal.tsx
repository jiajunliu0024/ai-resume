import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { GenerateResumePdfInput, ResumePdfTemplateId } from "../../infrastructure/pdf/resumePdfTypes";
import { isResumePdfTemplateId, RESUME_PDF_TEMPLATES } from "../../infrastructure/pdf/resumePdfTypes";

type TailorTailoredPdfPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  input: GenerateResumePdfInput | null;
  /** Bumps when structured resume data changes (e.g. `Resume.updatedAt`). */
  inputVersion: string;
  layoutId: ResumePdfTemplateId;
  onLayoutChange: (id: ResumePdfTemplateId) => void;
  onDownloadTailored: () => void;
  downloadBusy: boolean;
};

export function TailorTailoredPdfPreviewModal({
  open,
  onClose,
  input,
  inputVersion,
  layoutId,
  onLayoutChange,
  onDownloadTailored,
  downloadBusy,
}: TailorTailoredPdfPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef(input);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

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
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    function revokeCurrent() {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobUrl(null);
    }

    if (!open) {
      return undefined;
    }

    const latestInput = inputRef.current;
    if (!latestInput) {
      revokeCurrent();
      setStatus("error");
      setErrorMessage("No resume data to preview.");
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setStatus("loading");
      setErrorMessage(null);
      revokeCurrent();

      try {
        const { generateResumePdfBlob } = await import("../../infrastructure/pdf/generateResumePdf");
        const blob = await generateResumePdfBlob(latestInput, layoutId);
        if (cancelled) {
          return;
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Could not generate tailored PDF for preview.";
        setErrorMessage(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      revokeCurrent();
    };
  }, [open, layoutId, inputVersion]);

  function handleDialogClose() {
    onClose();
  }

  function handleLayoutSelect(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (isResumePdfTemplateId(next)) {
      onLayoutChange(next);
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
            <h2 className="tailor-pdf-preview-title">Tailored résumé PDF</h2>
            <p className="helper-text tailor-pdf-preview-sub">
              Live preview of your Tailor data rendered with <strong>@react-pdf</strong> (same
              output as download).
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
          <label className="field-label" htmlFor="tailor-tailored-preview-layout">
            Résumé template
          </label>
          <select
            id="tailor-tailored-preview-layout"
            className="text-input tailor-pdf-template-select"
            value={layoutId}
            onChange={handleLayoutSelect}
          >
            {RESUME_PDF_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="tailor-pdf-preview-frame-wrap">
          {status === "loading" ? (
            <div className="tailor-pdf-preview-loading">
              <span className="tailor-rewriter-spinner" aria-hidden="true" />
              <span>Generating PDF…</span>
            </div>
          ) : null}
          {status === "error" ? (
            <p className="error-text tailor-pdf-preview-error">{errorMessage}</p>
          ) : null}
          {blobUrl ? (
            <iframe className="tailor-pdf-preview-iframe" title="Tailored résumé PDF preview" src={blobUrl} />
          ) : null}
        </div>

        <footer className="tailor-pdf-preview-footer">
          <button
            type="button"
            className="button primary tailor-pdf-download"
            disabled={!input || downloadBusy || status !== "ready"}
            onClick={() => onDownloadTailored()}
          >
            {downloadBusy ? "Preparing…" : "Download tailored PDF"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

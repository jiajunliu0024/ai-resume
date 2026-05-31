import { useMemo, useState } from "react";
import { type ScanJobPageResult } from "../../application/scanJobPage";
import { type ExtractedRequirement } from "../../domain/jobDescription";
import { APP_FLOW_STEPS } from "../../shared/appFlowSteps";
import { Card } from "../components/Card";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { LoadingSteps, type LoadingStepItem } from "../components/LoadingSteps";
import { PrimaryButton } from "../components/PrimaryButton";

export type ScanPhase = "reading-page" | "extracting-ai" | null;

type ScanPageProps = {
  apiKeyConfigured: boolean;
  error: string | null;
  isScanning: boolean;
  scanPhase: ScanPhase;
  scannedJob: ScanJobPageResult | null;
  onGoToResume: () => void;
  onGoToCoverLetter: () => void;
  onOpenSettings: () => void;
  onScan: () => void;
};

export function ScanPage({
  apiKeyConfigured,
  error,
  isScanning,
  scanPhase,
  scannedJob,
  onGoToResume,
  onGoToCoverLetter,
  onOpenSettings,
  onScan,
}: ScanPageProps) {
  const [selectedInsight, setSelectedInsight] =
    useState<ExtractedRequirement | null>(null);

  const loadingSteps = useMemo((): LoadingStepItem[] => {
    const readingState =
      scanPhase === "reading-page"
        ? "active"
        : scanPhase === "extracting-ai"
          ? "done"
          : "pending";
    const aiState =
      scanPhase === "extracting-ai"
        ? "active"
        : "pending";

    return [
      { id: "read", label: "Reading job page from this tab", state: readingState },
      { id: "ai", label: "Extracting title, requirements, and keywords", state: aiState },
    ];
  }, [scanPhase]);

  const overlayLabel =
    scanPhase === "extracting-ai"
      ? "Analyzing with AI…"
      : "Reading job page…";

  const overlayDetail =
    scanPhase === "extracting-ai"
      ? "This usually takes a few seconds. Your API key calls the provider directly."
      : "Scanning the active tab. Stay on the job posting.";

  function findInsightContext(insight: ExtractedRequirement): string {
    if (!scannedJob) {
      return "";
    }

    const rawText = scannedJob.rawText;
    const searchTerms = [insight.evidence, insight.text].filter(Boolean);
    const matchedTerm = searchTerms.find((term) => {
      return rawText.toLowerCase().includes(term.toLowerCase());
    });

    if (!matchedTerm) {
      return insight.evidence || "No matching context found in the JD text.";
    }

    const matchIndex = rawText.toLowerCase().indexOf(matchedTerm.toLowerCase());
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(rawText.length, matchIndex + matchedTerm.length + 50);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < rawText.length ? "..." : "";

    return `${prefix}${rawText.slice(start, end)}${suffix}`;
  }

  return (
    <main className="page stack">
      {!apiKeyConfigured ? (
        <div className="api-key-inline-banner" role="status">
          <p>
            <strong>API key required to scan.</strong> Add your provider key in Settings (menu,
            top right) to run AI extraction on this tab. Your key is stored only on this device.
          </p>
          <PrimaryButton type="button" variant="secondary" onClick={onOpenSettings}>
            Open Settings
          </PrimaryButton>
        </div>
      ) : null}

      <header className="page-step-header">
        <h1>{APP_FLOW_STEPS.scan.label}</h1>
        <p className="page-step-subtitle">{APP_FLOW_STEPS.scan.pageSubtitle}</p>
      </header>

      <Card tone="soft">
        <div className="center stack">
          <div className={`large-icon${isScanning ? " large-icon--pulse" : ""}`} aria-hidden="true">
            {isScanning ? <LoadingSpinner size="lg" onLight /> : "⌕"}
          </div>
          <p className="muted">
            {isScanning
              ? "Working on your scan — please keep this job tab open."
              : "When you are ready, capture text from the active tab and run structured extraction."}
          </p>
          <PrimaryButton type="button" loading={isScanning} onClick={onScan}>
            {isScanning ? "Scanning…" : "Scan Current Page"}
          </PrimaryButton>
        </div>
      </Card>

      {isScanning ? (
        <Card tone="soft" className="scan-progress-card">
          <div className="scan-progress-card-inner">
            <LoadingSpinner size="md" onLight />
            <p className="loading-overlay-label">{overlayLabel}</p>
            <p className="loading-overlay-detail">{overlayDetail}</p>
            <LoadingSteps steps={loadingSteps} />
          </div>
        </Card>
      ) : null}

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <LoadingOverlay active={isScanning} label={overlayLabel} detail={overlayDetail}>
        <Card>
          <div className="section-header">
            <span className="eyebrow">Extracted Job</span>
            <button className="link-button" type="button" disabled={isScanning}>
              Edit
            </button>
          </div>

          {isScanning && !scannedJob ? (
            <div className="scan-skeleton" aria-hidden="true">
              <div className="scan-skeleton-line scan-skeleton-line--title" />
              <div className="scan-skeleton-line scan-skeleton-line--short" />
              <div className="scan-skeleton-line" />
              <div className="scan-skeleton-line" />
            </div>
          ) : null}

          <h2>{scannedJob?.title || "Job title will appear here"}</h2>
          {scannedJob ? (
            <div className="stack">
              <p className="company-name">{scannedJob.company}</p>
              <p className="muted">{scannedJob.sourceUrl}</p>
              <div className="insight-block">
                <span className="eyebrow">Key Requirements</span>
                {scannedJob.requirements.length > 0 ? (
                  <ul className="insight-list">
                    {scannedJob.requirements.map((requirement) => (
                      <li key={requirement.id}>
                        <span className="insight-list-bullet" aria-hidden="true">
                          •
                        </span>
                        <button
                          className="insight-button"
                          type="button"
                          onClick={() => setSelectedInsight(requirement)}
                        >
                          {requirement.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No requirements extracted yet.</p>
                )}
              </div>

              <div className="insight-block">
                <span className="eyebrow">Keywords</span>
                {scannedJob.keywords.length > 0 ? (
                  <div className="chip-list">
                    {scannedJob.keywords.map((keyword) => (
                      <button
                        className="chip chip-button"
                        key={keyword.id}
                        type="button"
                        onClick={() => setSelectedInsight(keyword)}
                      >
                        {keyword.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No keywords extracted yet.</p>
                )}
              </div>
            </div>
          ) : (
            !isScanning && (
              <p className="muted">
                Run <strong>Scan Current Page</strong> to read the active tab and extract
                requirements and keywords with AI (requires an API key).
              </p>
            )
          )}
        </Card>
      </LoadingOverlay>

      <div className="footer-actions sticky-footer-actions two-columns">
        <PrimaryButton type="button" disabled={!scannedJob || isScanning} onClick={onGoToResume}>
          Add resume
        </PrimaryButton>
        <PrimaryButton
          type="button"
          variant="secondary"
          disabled={!scannedJob || isScanning}
          onClick={onGoToCoverLetter}
        >
          Generate cover letter
        </PrimaryButton>
      </div>

      {selectedInsight && (
        <div className="modal-backdrop" role="presentation">
          <section className="context-modal" aria-label="JD context">
            <div className="section-header">
              <span className="eyebrow">JD Context</span>
              <button
                className="link-button"
                type="button"
                onClick={() => setSelectedInsight(null)}
              >
                Close
              </button>
            </div>
            <strong>{selectedInsight.text}</strong>
            <p>{findInsightContext(selectedInsight)}</p>
          </section>
        </div>
      )}
    </main>
  );
}

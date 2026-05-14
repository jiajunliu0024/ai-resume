import { useState } from "react";
import { type ScanJobPageResult } from "../../application/scanJobPage";
import { type ExtractedRequirement } from "../../domain/jobDescription";
import { APP_FLOW_STEPS } from "../../shared/appFlowSteps";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";

// ScanPage is intentionally a presentational component.
// It receives state and callbacks from App instead of calling Chrome or OpenAI directly.
type ScanPageProps = {
  apiKeyConfigured: boolean;
  error: string | null;
  isScanning: boolean;
  scannedJob: ScanJobPageResult | null;
  onNext: () => void;
  onOpenSettings: () => void;
  onScan: () => void;
};

export function ScanPage({
  apiKeyConfigured,
  error,
  isScanning,
  scannedJob,
  onNext,
  onOpenSettings,
  onScan,
}: ScanPageProps) {
  const [selectedInsight, setSelectedInsight] =
    useState<ExtractedRequirement | null>(null);

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
          <div className="large-icon">⌕</div>
          <p className="muted">
            When you are ready, capture text from the active tab and run structured extraction.
          </p>
          <PrimaryButton type="button" disabled={isScanning} onClick={onScan}>
            {isScanning ? "Scanning..." : "Scan Current Page"}
          </PrimaryButton>
        </div>
      </Card>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <Card>
        <div className="section-header">
          <span className="eyebrow">Extracted Job</span>
          {/* Edit is a placeholder for a later manual correction flow. */}
          <button className="link-button" type="button">
            Edit
          </button>
        </div>
        <h2>{scannedJob?.title || "Job title will appear here"}</h2>
        {scannedJob ? (
          <div className="stack">
            <p className="company-name">{scannedJob.company}</p>
            <p className="muted">{scannedJob.sourceUrl}</p>
            <div className="insight-block">
              <span className="eyebrow">Key Requirements</span>
              {/* These requirements come from OpenAI after scan succeeds. */}
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
              {/* Keywords are shown as chips because later pages will use them for resume tailoring. */}
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
          <p className="muted">
            Run <strong>Scan Current Page</strong> to read the active tab and extract requirements and
            keywords with AI (requires an API key).
          </p>
        )}
      </Card>

      <div className="footer-actions sticky-footer-actions">
        <PrimaryButton type="button" disabled={!scannedJob} onClick={onNext}>
          Next: Resume
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

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ScanJobPageResult } from "../../application/scanJobPage";
import { generateCoverLetter } from "../../application/generateCoverLetter";
import { listResumeChunksForCoverLetter } from "../../application/listResumeChunksForCoverLetter";
import type { CoverLetter } from "../../domain/coverLetter";
import type { ExtractedRequirement } from "../../domain/jobDescription";
import type { Resume } from "../../domain/resume";
import type { AiProviderId } from "../../infrastructure/ai/openAiJobInsightsExtractor";
import { downloadTextFile } from "../../infrastructure/export/downloadTextFile";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";

type ResultsPageProps = {
  job: ScanJobPageResult | null;
  resume: Resume | null;
  apiKey: string;
  aiProvider: AiProviderId;
  onBack: () => void;
  onOpenSettings: () => void;
};

function slugForFilename(raw: string) {
  return raw
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function ResultsPage({
  job,
  resume,
  apiKey,
  aiProvider,
  onBack,
  onOpenSettings,
}: ResultsPageProps) {
  const hasApiKey = Boolean(apiKey.trim());
  const resumeChunks = useMemo(() => listResumeChunksForCoverLetter(resume), [resume]);

  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(
    () => new Set(job?.keywords.map((k) => k.id) ?? []),
  );
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(
    () => new Set(job?.requirements.map((r) => r.id) ?? []),
  );
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(
    () => new Set(listResumeChunksForCoverLetter(resume).map((c) => c.id)),
  );

  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const toggleId = useCallback((setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const canGenerate =
    Boolean(job) &&
    Boolean(resume) &&
    hasApiKey &&
    (selectedKeywordIds.size > 0 ||
      selectedRequirementIds.size > 0 ||
      selectedChunkIds.size > 0);

  async function handleGenerate() {
    if (!job || !resume || !hasApiKey) {
      if (!hasApiKey) {
        onOpenSettings();
      }
      return;
    }

    setGenerating(true);
    setError(null);
    setCopyHint(null);
    try {
      const next = await generateCoverLetter({
        job,
        resume,
        selectedKeywordIds,
        selectedRequirementIds,
        selectedResumeChunkIds: selectedChunkIds,
        apiKey: apiKey.trim(),
        providerId: aiProvider,
      });
      setCoverLetter(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate cover letter.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!coverLetter?.content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(coverLetter.content);
      setCopyHint("Copied to clipboard.");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("Copy blocked — select the preview text manually.");
    }
  }

  function handleDownload() {
    if (!coverLetter?.content || !job) {
      return;
    }
    const company = slugForFilename(job.company || "company");
    const role = slugForFilename(job.title || "cover-letter");
    downloadTextFile(`cover-letter-${company}-${role}.txt`, coverLetter.content);
  }

  if (!job || !resume) {
    return (
      <main className="page stack">
        <Card>
          <h2 className="tailor-pdf-trigger-title">Cover letter</h2>
          <p className="muted">
            Scan a job and select a resume first, then return here from the Tailor step.
          </p>
        </Card>
        <div className="footer-actions">
          <PrimaryButton type="button" variant="secondary" onClick={onBack}>
            Back
          </PrimaryButton>
        </div>
      </main>
    );
  }

  return (
    <main className="page stack">
      <Card>
        <div className="cover-letter-card-head">
          <h2 className="tailor-pdf-trigger-title">Cover letter</h2>
          <p className="muted cover-letter-job-inline">
            {job.title} · {job.company}
          </p>
        </div>
        <p className="helper-text">
          Pick JD <strong>keywords</strong>, <strong>key requirements</strong>, and{" "}
          <strong>resume excerpts</strong> below. Only checked items are sent to the model. Add your
          API key in Settings if needed.
        </p>

        <div className="cover-letter-sources">
          <section className="cover-letter-source-block">
            <h3 className="cover-letter-source-title">Keywords</h3>
            {job.keywords.length ? (
              <div className="cover-letter-chip-grid">
                {job.keywords.map((keyword: ExtractedRequirement) => {
                  const checked = selectedKeywordIds.has(keyword.id);
                  return (
                    <label key={keyword.id} className="cover-letter-chip">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(setSelectedKeywordIds, keyword.id)}
                      />
                      <span>{keyword.text}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No keywords on this scan.</p>
            )}
          </section>

          <section className="cover-letter-source-block">
            <h3 className="cover-letter-source-title">Key requirements</h3>
            {job.requirements.length ? (
              <ul className="cover-letter-req-list">
                {job.requirements.map((requirement: ExtractedRequirement) => (
                  <li key={requirement.id}>
                    <label className="cover-letter-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedRequirementIds.has(requirement.id)}
                        onChange={() => toggleId(setSelectedRequirementIds, requirement.id)}
                      />
                      <span>{requirement.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No requirements on this scan.</p>
            )}
          </section>

          <details className="cover-letter-details" open>
            <summary>Resume excerpts to include</summary>
            <p className="helper-text cover-letter-details-hint">
              Choose the parts of your resume the letter may reference. Uncheck anything you do not
              want mentioned.
            </p>
            {resumeChunks.length ? (
              <ul className="cover-letter-req-list">
                {resumeChunks.map((chunk) => (
                  <li key={chunk.id}>
                    <label className="cover-letter-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedChunkIds.has(chunk.id)}
                        onChange={() => toggleId(setSelectedChunkIds, chunk.id)}
                      />
                      <span>{chunk.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No structured resume sections found.</p>
            )}
          </details>
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cover-letter-generate-row">
          <PrimaryButton
            type="button"
            disabled={!canGenerate || generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? "Generating…" : "Generate cover letter"}
          </PrimaryButton>
          {!hasApiKey ? (
            <button type="button" className="link-button" onClick={onOpenSettings}>
              Open settings to add API key
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Preview</h2>
          <div className="section-header-actions cover-letter-preview-actions">
            <button
              type="button"
              className="link-button"
              disabled={!coverLetter?.content}
              onClick={() => void handleCopy()}
            >
              Copy
            </button>
            <button
              type="button"
              className="link-button"
              disabled={!coverLetter?.content}
              onClick={handleDownload}
            >
              Download .txt
            </button>
          </div>
        </div>
        {copyHint ? <p className="helper-text">{copyHint}</p> : null}
        <div className="cover-letter-preview">
          {coverLetter?.content ? (
            coverLetter.content
          ) : (
            <span className="muted">Generated letter will appear here.</span>
          )}
        </div>
      </Card>

      <div className="footer-actions">
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back
        </PrimaryButton>
      </div>
    </main>
  );
}

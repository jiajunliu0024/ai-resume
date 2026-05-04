import { useEffect, useRef, useState } from "react";
import { type ScanJobPageResult } from "../../application/scanJobPage";
import {
  countWords,
  rewriteTailorResumeSegment,
  TAILOR_REWRITE_WORD_MARGIN,
  type TailorSelectedRequirement,
} from "../../application/rewriteTailorResumeSegment";
import {
  getAiProviderChatCompletionConfig,
  type AiProviderId,
} from "../../infrastructure/ai/openAiJobInsightsExtractor";

export type TailorAiRewriteOpenPayload =
  | { kind: "summary"; originalText: string }
  | {
      kind: "experienceAchievement";
      itemId: string;
      achievementIndex: number;
      originalText: string;
    };

type TailorAiRewriterDialogProps = {
  job: ScanJobPageResult | null;
  context: TailorAiRewriteOpenPayload;
  apiKey: string;
  aiProvider: AiProviderId;
  onClose: () => void;
  onApply: (rewritten: string) => void;
  onOpenSettings: () => void;
};

const INITIAL_KEYWORD_CAP = 10;

function defaultSelectedKeywords(job: ScanJobPageResult | null, originalText: string): Set<string> {
  const texts = (job?.keywords ?? []).map((keyword) => keyword.text).filter(Boolean);
  if (!texts.length) {
    return new Set();
  }

  const lower = originalText.toLowerCase();
  const matched = texts.filter((text) => lower.includes(text.toLowerCase()));
  const pick = matched.length > 0 ? matched.slice(0, 6) : texts.slice(0, 4);

  return new Set(pick);
}

function defaultSelectedRequirementIds(job: ScanJobPageResult | null): Set<string> {
  const requirements = job?.requirements ?? [];
  if (!requirements.length) {
    return new Set();
  }

  const high = requirements.filter((item) => item.importance === "high").slice(0, 4);
  const pick = high.length > 0 ? high : requirements.slice(0, 4);

  return new Set(pick.map((item) => item.id));
}

/** Draft text and API debug logs live in React state only; each Generate/Regenerate calls the provider (no extension storage on this path). */
export function TailorAiRewriterDialog({
  job,
  context,
  apiKey,
  aiProvider,
  onClose,
  onApply,
  onOpenSettings,
}: TailorAiRewriterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const originalText = context.originalText.trim();

  const [suggestion, setSuggestion] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(() =>
    defaultSelectedKeywords(job, originalText),
  );
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(
    () => defaultSelectedRequirementIds(job),
  );
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wordCountNote, setWordCountNote] = useState<string | null>(null);
  const [requestLogText, setRequestLogText] = useState("");
  const [responseLogText, setResponseLogText] = useState("");

  const providerMeta = getAiProviderChatCompletionConfig(aiProvider);
  const providerLabel = `${providerMeta.displayName} · ${providerMeta.model}`;

  const targetBase = countWords(originalText);
  const minTarget = Math.max(6, targetBase - TAILOR_REWRITE_WORD_MARGIN);
  const maxTarget = targetBase + TAILOR_REWRITE_WORD_MARGIN;

  const allKeywordTexts = (job?.keywords ?? []).map((keyword) => keyword.text).filter(Boolean);
  const visibleKeywords = showAllKeywords
    ? allKeywordTexts
    : allKeywordTexts.slice(0, INITIAL_KEYWORD_CAP);

  async function runRewrite(
    keywordSet: Set<string>,
    requirementIdSet: Set<string>,
    original: string,
  ) {
    if (!original.trim()) {
      return;
    }

    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }

    setIsLoading(true);
    setError(null);
    setWordCountNote(null);

    const selectedRequirements: TailorSelectedRequirement[] =
      job?.requirements
        .filter((requirement) => requirementIdSet.has(requirement.id))
        .map((requirement) => ({
          text: requirement.text.trim(),
          category: requirement.category,
        }))
        .filter((row) => row.text.length > 0) ?? [];

    try {
      const outcome = await rewriteTailorResumeSegment({
        originalText: original,
        selectedKeywords: [...keywordSet],
        selectedRequirements,
        apiKey: apiKey.trim(),
        providerId: aiProvider,
      });

      setRequestLogText(JSON.stringify(outcome.requestJson, null, 2));
      setResponseLogText(JSON.stringify(outcome.responseJson ?? null, null, 2));

      if (outcome.ok) {
        setSuggestion(outcome.rewritten);
        const wc = countWords(outcome.rewritten);
        const minW = Math.max(6, countWords(original) - TAILOR_REWRITE_WORD_MARGIN);
        const maxW = countWords(original) + TAILOR_REWRITE_WORD_MARGIN;
        if (wc < minW || wc > maxW) {
          setWordCountNote(
            `Model returned ${wc} words (target ${minW}–${maxW}). You can edit the text or regenerate.`,
          );
        }
      } else {
        setError(outcome.message);
      }
    } catch (unexpected) {
      const message =
        unexpected instanceof Error ? unexpected.message : "Rewrite request failed.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.showModal();

    return () => {
      dialog.close();
    };
  }, []);

  function toggleKeyword(text: string) {
    setSelectedKeywords((previous) => {
      const next = new Set(previous);
      if (next.has(text)) {
        next.delete(text);
      } else {
        next.add(text);
      }

      return next;
    });
  }

  function toggleRequirement(id: string) {
    setSelectedRequirementIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function handleRegenerate() {
    void runRewrite(selectedKeywords, selectedRequirementIds, originalText);
  }

  function handleApplyClick() {
    const next = suggestion.trim();
    if (!next) {
      return;
    }

    onApply(next);
    onClose();
  }

  function handleDialogClose() {
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="tailor-rewriter-dialog" onClose={handleDialogClose}>
      <div className="tailor-rewriter-panel">
        <header className="tailor-rewriter-header">
          <h2 className="tailor-rewriter-title">
            <span aria-hidden="true">✨</span> AI Rewriter
          </h2>
          <button
            type="button"
            className="icon-only-button"
            aria-label="Close rewriter"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>

        <div className="tailor-rewriter-body">
          <p className="helper-text tailor-rewriter-intro">
            Choose JD keywords and requirements below, then press{" "}
            <strong>Generate with AI</strong>. Nothing is sent to your provider until you do.
          </p>
          <div className="tailor-rewriter-columns">
            <div className="tailor-rewriter-column">
              <span className="tailor-rewriter-column-label">Original</span>
              <div className="tailor-rewriter-original-box">{originalText}</div>
              <p className="helper-text">
                {targetBase} words · target after rewrite {minTarget}–{maxTarget} words
              </p>
            </div>
            <div className="tailor-rewriter-column">
              <div className="tailor-rewriter-suggested-head">
                <span className="tailor-rewriter-column-label">AI suggested</span>
                <span className="tailor-rewriter-model-pill">{providerLabel}</span>
              </div>
              <label
                className={`tailor-rewriter-suggested-wrap ${isLoading ? "is-loading" : ""}`}
                aria-busy={isLoading}
              >
                <span className="sr-only">Edited suggestion</span>
                <textarea
                  className="textarea tailor-rewriter-suggestion-textarea"
                  rows={8}
                  value={suggestion}
                  disabled={isLoading}
                  onChange={(event) => setSuggestion(event.target.value)}
                />
                {isLoading ? (
                  <div className="tailor-rewriter-suggestion-loading-overlay" aria-live="polite">
                    <span className="tailor-rewriter-spinner" aria-hidden="true" />
                    <span className="tailor-rewriter-loading-label">Rewriting…</span>
                  </div>
                ) : null}
                <span className="tailor-rewriter-editable-hint">Editable</span>
              </label>
              {wordCountNote ? <p className="helper-text">{wordCountNote}</p> : null}
            </div>
          </div>

          <div className="tailor-rewriter-actions">
            {suggestion.trim() ? (
              <button
                type="button"
                className="section-edit-button"
                disabled={isLoading}
                onClick={handleRegenerate}
              >
                ↻ Regenerate
              </button>
            ) : (
              <button
                type="button"
                className="button primary"
                disabled={isLoading}
                onClick={handleRegenerate}
              >
                Generate with AI
              </button>
            )}
            <button
              type="button"
              className="button primary"
              disabled={isLoading || !suggestion.trim()}
              onClick={handleApplyClick}
            >
              ✓ Apply
            </button>
          </div>

          {job ? (
            <div className="tailor-rewriter-context">
              <h3 className="tailor-rewriter-context-title">Job requirements</h3>
              <p className="helper-text">
                Concrete lines (years, licenses, certificates, must-have tools) are weighted so the
                rewrite can echo them when your original supports that; softer lines steer tone only.
              </p>
              <ul className="tailor-rewriter-req-list">
                {job.requirements.map((requirement) => {
                  const selected = selectedRequirementIds.has(requirement.id);

                  return (
                    <li key={requirement.id}>
                      <button
                        type="button"
                        className={`tailor-rewriter-req-row ${selected ? "selected" : ""}`}
                        disabled={isLoading}
                        onClick={() => toggleRequirement(requirement.id)}
                      >
                        <span className="tailor-rewriter-req-check" aria-hidden="true">
                          {selected ? "✓" : ""}
                        </span>
                        <span>{requirement.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <h3 className="tailor-rewriter-context-title">JD keywords</h3>
              <p className="helper-text">
                Click chips to send those terms to the model; it will rephrase the bullet so it
                naturally reflects them when truthful (e.g. Java, Python, Excel).
              </p>
              <div className="tailor-rewriter-keyword-chips">
                {visibleKeywords.map((text, keywordIndex) => {
                  const selected = selectedKeywords.has(text);

                  return (
                    <button
                      key={`${text}-${keywordIndex}`}
                      type="button"
                      className={`tailor-rewriter-keyword-chip ${selected ? "selected" : ""}`}
                      disabled={isLoading}
                      onClick={() => toggleKeyword(text)}
                    >
                      {selected ? "✓ " : ""}
                      {text}
                    </button>
                  );
                })}
              </div>
              {allKeywordTexts.length > INITIAL_KEYWORD_CAP ? (
                <button
                  type="button"
                  className="link-button tailor-rewriter-show-more"
                  disabled={isLoading}
                  onClick={() => setShowAllKeywords((value) => !value)}
                >
                  {showAllKeywords ? "Show fewer" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="helper-text">
              No job scanned yet — AI Rewrite still runs on your paragraph alone. Scan a job to
              add JD requirements and keyword chips to the prompt.
            </p>
          )}

          {error ? <p className="error-text">{error}</p> : null}

          {requestLogText || responseLogText ? (
            <div className="json-debug-panel tailor-rewriter-api-log">
              <p className="helper-text tailor-rewriter-api-log-note">
                Last request/response (session only; Authorization header is never shown). Each
                Generate or Regenerate calls your provider again.
              </p>
              {requestLogText ? (
                <details open>
                  <summary>Request JSON (body)</summary>
                  <pre>{requestLogText}</pre>
                </details>
              ) : null}
              {responseLogText ? (
                <details open>
                  <summary>Response JSON</summary>
                  <pre>{responseLogText}</pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="tailor-rewriter-footer">
          <button
            type="button"
            className="button secondary tailor-rewriter-discard"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel &amp; discard
          </button>
        </footer>
      </div>
    </dialog>
  );
}

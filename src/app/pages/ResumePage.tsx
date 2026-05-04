import { type ChangeEvent, useState } from "react";
import { parseResume } from "../../application/parseResume";
import { type Resume } from "../../domain/resume";
import { type AiProviderId } from "../../infrastructure/ai/openAiJobInsightsExtractor";
import { supportsResumePdfVisionParsing } from "../../infrastructure/ai/aiResumeParser";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";

type ResumePageProps = {
  apiKey: string;
  aiProvider: AiProviderId;
  jobTitle?: string;
  resumes: Resume[];
  resume: Resume | null;
  onBack: () => void;
  onResumesAdd: (resumes: Resume[]) => void;
  onResumeDelete: (resumeId: string) => void;
  onResumeSelect: (resumeId: string) => void;
  onNext: () => void;
};

export function ResumePage({
  apiKey,
  aiProvider,
  jobTitle,
  resumes,
  resume,
  onBack,
  onResumesAdd,
  onResumeDelete,
  onResumeSelect,
  onNext,
}: ResumePageProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    if (
      files.some(
        (file) =>
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf"),
      )
    ) {
      setUploadError("Upload PDF resume files only.");
      return;
    }

    setIsParsingPdf(true);
    setUploadError(null);
    setParseMessage(
      apiKey.trim() && supportsResumePdfVisionParsing(aiProvider)
        ? "Rendering PDF pages and sending images to OpenAI (no extracted text in the AI request)..."
        : apiKey.trim()
          ? "Extracting PDF text and using local parser (OpenAI required for PDF vision AI parse)..."
          : "Extracting PDF text and using local fallback parser...",
    );

    try {
      const parsedResumes: Resume[] = [];

      for (const file of files) {
        parsedResumes.push(
          await parseResume(file.name, file, {
            apiKey,
            aiProvider,
          }),
        );
      }

      onResumesAdd(parsedResumes);
      setParseMessage(
        parsedResumes.some((resume) => resume.parseSource === "ai")
          ? "Resume parsed with AI and saved locally."
          : "Resume parsed with local fallback and saved locally.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not parse this PDF.";
      setUploadError(message);
    } finally {
      setIsParsingPdf(false);
      event.target.value = "";
    }
  }

  return (
    <main className="page stack">
      <section className="stack">
        <h1>Select Resume</h1>
        <p className="muted">
          Choose the resume foundation first. The next Tailor page handles AI
          rewrite and section-level editing.
        </p>
        {jobTitle && <p className="company-name">For: {jobTitle}</p>}
      </section>

      {resumes.map((resumeItem) => {
        const isSelected = resumeItem.id === resume?.id;

        return (
          <section
            className={`card resume-card ${isSelected ? "selected-card" : ""}`}
            key={resumeItem.id}
          >
            <button
              className={`radio ${isSelected ? "on" : ""}`}
              type="button"
              aria-label={`Select ${resumeItem.title}`}
              onClick={() => onResumeSelect(resumeItem.id)}
            />
            <button
              className="resume-card-main"
              type="button"
              onClick={() => onResumeSelect(resumeItem.id)}
            >
              <h2 className="truncate-text">{resumeItem.title}</h2>
              <p className="muted">
                Parsed locally into basic info, skills, experience, projects,
                and education.
              </p>
              <div className="chip-list">
                <span className="chip">PDF</span>
                <span className="chip">
                  {resumeItem.parseSource === "ai" ? "AI parsed" : "Local fallback"}
                </span>
              </div>
            </button>
            <div className="resume-card-actions">
              <span className="fit">{isSelected ? "SELECTED" : "READY"}</span>
              <button
                className="delete-resume-button"
                type="button"
                aria-label={`Delete ${resumeItem.title}`}
                onClick={() => onResumeDelete(resumeItem.id)}
              >
                Delete
              </button>
            </div>
          </section>
        );
      })}

      <Card>
        <label
          className={`upload-box ${isParsingPdf ? "loading" : ""}`}
          htmlFor={isParsingPdf ? undefined : "resume-file"}
        >
          <span className="upload-icon">
            {isParsingPdf ? <span className="spinner" aria-hidden="true" /> : "+"}
          </span>
          <span>
            <strong>{isParsingPdf ? "Parsing Resume" : "Add Resumes"}</strong>
            <small>
              {isParsingPdf
                ? apiKey.trim() && supportsResumePdfVisionParsing(aiProvider)
                  ? "Rendering PDF pages → OpenAI vision (JSON)"
                  : "Local text extraction + rule-based parsing"
                : "Multiple PDFs supported"}
            </small>
          </span>
        </label>
        <input
          id="resume-file"
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,application/pdf"
          disabled={isParsingPdf}
          onChange={handleFileChange}
        />
        {resume?.title && <p className="helper-text">Selected: {resume.title}</p>}
        {parseMessage && <p className="helper-text">{parseMessage}</p>}
        {uploadError && <p className="error-text">{uploadError}</p>}
      </Card>

      <Card tone="soft">
        <div className="section-header">
          <span className="eyebrow">Next Step</span>
          <span className="fit">{resume?.rawText.trim() ? "Ready" : "Waiting"}</span>
        </div>
        <p>
          Tailor will compare this resume against the scanned job requirements,
          then show editable AI rewrite sections.
        </p>
        {resume?.parseSource && (
          <p className="helper-text">
            Parsed by {resume.parseSource === "ai" ? "AI" : "local fallback"} ·{" "}
            {resume.parserVersion ?? "unknown parser"}
          </p>
        )}
      </Card>

      <div className="footer-actions two-columns">
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back
        </PrimaryButton>
        <PrimaryButton
          type="button"
          disabled={isParsingPdf || !resume?.rawText.trim()}
          onClick={onNext}
        >
          {isParsingPdf ? "Parsing..." : "Tailor Resume"}
        </PrimaryButton>
      </div>
    </main>
  );
}

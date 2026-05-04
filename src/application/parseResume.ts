import { type Resume } from "../domain/resume";
import { type AiProviderId } from "../infrastructure/ai/openAiJobInsightsExtractor";
import {
  parseResumeWithAiProviderFromPdfPageImages,
  supportsResumePdfVisionParsing,
} from "../infrastructure/ai/aiResumeParser";
import {
  extractTextFromPdf,
  renderPdfPagesToImageDataUrls,
} from "../infrastructure/parser/pdfResumeParser";
import { parseResumeSections, type ParsedResumeSections } from "./parseResumeSections";

export const CURRENT_RESUME_PARSER_VERSION = "resume-parser-v3-local-merge-v1";

type ParseResumeOptions = {
  apiKey: string;
  aiProvider: AiProviderId;
};

function compileResumeText(resume: Pick<
  Resume,
  | "basicInfo"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
>): string {
  return [
    resume.basicInfo,
    resume.summary,
    resume.skills,
    resume.experience,
    resume.projects,
    resume.education,
    resume.certifications,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildResume(
  title: string,
  rawText: string,
  sections: ParsedResumeSections,
  parseSource: "ai" | "local",
): Resume {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    rawText: compileResumeText(sections) || rawText,
    ...sections,
    parseStatus: parseSource === "ai" ? "parsed" : "fallback",
    parseSource,
    parsedAt: now,
    parserVersion: CURRENT_RESUME_PARSER_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export function isResumeParsed(resume: Resume) {
  return (
    resume.parseStatus === "parsed" &&
    resume.parserVersion === CURRENT_RESUME_PARSER_VERSION &&
    Boolean(resume.basicInfoFields) &&
    Boolean(resume.experienceItems?.length || resume.educationItems?.length)
  );
}

/**
 * Parses a resume PDF: OpenAI path uses rendered page images only (no extracted text in the AI request).
 * Local fallback uses `extractTextFromPdf` + `parseResumeSections`.
 */
export async function parseResume(
  title: string,
  file: File,
  options: ParseResumeOptions,
): Promise<Resume> {
  const useVision =
    Boolean(options.apiKey.trim()) && supportsResumePdfVisionParsing(options.aiProvider);

  const textPromise = extractTextFromPdf(file)
    .then((text) => text.trim())
    .catch(() => "");

  const imagesPromise = useVision
    ? renderPdfPagesToImageDataUrls(file, {
        maxPages: 12,
        maxWidthPx: 1400,
        mimeType: "image/jpeg",
        jpegQuality: 0.9,
      })
    : Promise.resolve([] as string[]);

  const [rawText, pageImages] = await Promise.all([textPromise, imagesPromise]);

  if (useVision && pageImages.length) {
    try {
      const aiSections = await parseResumeWithAiProviderFromPdfPageImages(
        pageImages,
        options.apiKey.trim(),
        "openai",
      );

      return buildResume(title, rawText, aiSections, "ai");
    } catch (error) {
      console.warn("AI resume parsing failed; falling back locally.", error);
    }
  }

  if (!rawText.trim()) {
    throw new Error(
      "Could not read text from this PDF and AI vision parsing did not succeed. Try OpenAI with a valid API key, or use a PDF with selectable text.",
    );
  }

  return buildResume(title, rawText, parseResumeSections(rawText), "local");
}

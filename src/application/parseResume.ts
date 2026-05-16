import { type Resume } from "../domain/resume";
import { type AiProviderId } from "../infrastructure/ai/openAiJobInsightsExtractor";
import {
  parseResumeWithAiProviderFromPdfPageImages,
  parseResumeWithAiProviderFromPlainText,
  supportsResumePdfVisionParsing,
  supportsResumePlainTextAiParsing,
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
 * Parses a resume PDF:
 * - OpenAI / Gemini + key: rasterized page images → vision chat when available (extracted plain text not sent).
 * - Any provider + key + selectable PDF text: plain-text → chat JSON resume shape.
 * - Otherwise: extracted text + local `parseResumeSections`.
 */
export async function parseResume(
  title: string,
  file: File,
  options: ParseResumeOptions,
): Promise<Resume> {
  const apiKeyTrimmed = options.apiKey.trim();
  const useVisionPdfAi =
    Boolean(apiKeyTrimmed) && supportsResumePdfVisionParsing(options.aiProvider);

  const textPromise = extractTextFromPdf(file)
    .then((text) => text.trim())
    .catch(() => "");

  const imagesPromise = useVisionPdfAi
    ? renderPdfPagesToImageDataUrls(file, {
        maxPages: 12,
        maxWidthPx: 1400,
        mimeType: "image/jpeg",
        jpegQuality: 0.9,
      })
    : Promise.resolve([] as string[]);

  const [rawText, pageImages] = await Promise.all([textPromise, imagesPromise]);

  if (useVisionPdfAi && pageImages.length) {
    try {
      const aiSections = await parseResumeWithAiProviderFromPdfPageImages(
        pageImages,
        apiKeyTrimmed,
        options.aiProvider,
      );

      return buildResume(title, rawText, aiSections, "ai");
    } catch (error) {
      console.warn("Resume vision parsing failed; trying plain-text AI or local fallback.", error);
    }
  }

  if (
    Boolean(apiKeyTrimmed) &&
    supportsResumePlainTextAiParsing(options.aiProvider) &&
    rawText.trim()
  ) {
    try {
      const aiSections = await parseResumeWithAiProviderFromPlainText(
        rawText,
        apiKeyTrimmed,
        options.aiProvider,
      );

      return buildResume(title, rawText, aiSections, "ai");
    } catch (error) {
      console.warn("Resume plain-text AI parsing failed; falling back locally.", error);
    }
  }

  if (!rawText.trim()) {
    throw new Error(
      "Could not read text from this PDF and no AI parse succeeded. Use a PDF with selectable text, or try OpenAI / Gemini for vision parsing, another listed provider with a valid API key, or check the provider error in the developer console.",
    );
  }

  return buildResume(title, rawText, parseResumeSections(rawText), "local");
}

import { type Resume } from "../domain/resume";
import { type AiProviderId } from "../infrastructure/ai/openAiJobInsightsExtractor";
import {
  parseResumeWithAiProviderFromPdfPageImages,
  parseResumeWithAiProviderFromPlainText,
  supportsResumeDeepseekTextParsing,
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
 * Parses a resume PDF:
 * - OpenAI + key: rasterized page images → vision chat (extracted text is not sent in that request).
 * - DeepSeek + key: extracted plain text → chat JSON parse (same provider API as Scan).
 * - Otherwise: `extractTextFromPdf` + local `parseResumeSections`.
 */
export async function parseResume(
  title: string,
  file: File,
  options: ParseResumeOptions,
): Promise<Resume> {
  const apiKeyTrimmed = options.apiKey.trim();
  const useOpenAiVision =
    Boolean(apiKeyTrimmed) && supportsResumePdfVisionParsing(options.aiProvider);
  const useDeepseekTextAi =
    Boolean(apiKeyTrimmed) && supportsResumeDeepseekTextParsing(options.aiProvider);

  const textPromise = extractTextFromPdf(file)
    .then((text) => text.trim())
    .catch(() => "");

  const imagesPromise = useOpenAiVision
    ? renderPdfPagesToImageDataUrls(file, {
        maxPages: 12,
        maxWidthPx: 1400,
        mimeType: "image/jpeg",
        jpegQuality: 0.9,
      })
    : Promise.resolve([] as string[]);

  const [rawText, pageImages] = await Promise.all([textPromise, imagesPromise]);

  if (useOpenAiVision && pageImages.length) {
    try {
      const aiSections = await parseResumeWithAiProviderFromPdfPageImages(
        pageImages,
        apiKeyTrimmed,
        "openai",
      );

      return buildResume(title, rawText, aiSections, "ai");
    } catch (error) {
      console.warn("OpenAI resume vision parsing failed; falling back.", error);
    }
  }

  if (useDeepseekTextAi && rawText.trim()) {
    try {
      const aiSections = await parseResumeWithAiProviderFromPlainText(
        rawText,
        apiKeyTrimmed,
        "deepseek",
      );

      return buildResume(title, rawText, aiSections, "ai");
    } catch (error) {
      console.warn("DeepSeek resume text parsing failed; falling back locally.", error);
    }
  }

  if (!rawText.trim()) {
    throw new Error(
      "Could not read text from this PDF and no AI parse succeeded. Use a PDF with selectable text, or try OpenAI (vision) / DeepSeek (text) with a valid API key.",
    );
  }

  return buildResume(title, rawText, parseResumeSections(rawText), "local");
}

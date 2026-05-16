import { type JobDescription } from "../domain/jobDescription";
import { extractJobInsights } from "./extractJobInsights";

// Input from the browser page scanner before AI enrichment.
export type ScanJobPageInput = {
  sourceUrl: string;
  pageTitle: string;
  pageText: string;
  debugLog?: string;
};

// The scan result is the central object passed from Scan to later steps.
// AI extraction later replaces requirements/keywords with better results.
export type ScanJobPageResult = Pick<
  JobDescription,
  | "title"
  | "company"
  | "sourceUrl"
  | "rawText"
  | "requirements"
  | "keywords"
  | "confidence"
> & {
  debugLog?: string;
};

export function scanJobPage(input: ScanJobPageInput): ScanJobPageResult {
  // Local extraction provides a fallback shape before OpenAI runs.
  // The App layer currently overwrites these insights with AI output.
  const insights = extractJobInsights(input.pageText);

  const mergedCompany =
    insights.company?.trim().length ?
      insights.company.trim()
    : "Unknown company";

  return {
    title: input.pageTitle,
    company: mergedCompany,
    sourceUrl: input.sourceUrl,
    rawText: input.pageText,
    requirements: insights.requirements,
    keywords: insights.keywords,
    confidence: insights.confidence,
    debugLog: input.debugLog,
  };
}

import {
  type ExtractedRequirement,
  type RequirementCategory,
} from "../domain/jobDescription";

export type ExtractJobInsightsResult = {
  jobTitle?: string;
  company?: string;
  requirements: ExtractedRequirement[];
  keywords: ExtractedRequirement[];
  confidence: number;
};

// Local keyword patterns are a fallback for MVP resilience.
// OpenAI normally produces the final displayed requirements/keywords.
const technicalKeywordPatterns = [
  "C#",
  "PowerShell",
  "Regular Expressions",
  "REST",
  "OData",
  "SOAP",
  "Web Services",
  "SQL Server",
  "SQL scripting",
  "Business Analysis",
  "Data Capture",
  "Document Management",
  "Workflow Automation",
  "Robotic Process Automation",
  "RPA",
  "Data Integration",
  "Prompt Engineering",
];

// These headings help the fallback extractor focus on useful JD sections.
const requirementHeadings = [
  "what you will do",
  "key skills required",
  "key technical skills",
  "requirements",
  "responsibilities",
  "about the role",
  "experience",
  "qualifications",
];

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// SEEK job drawers usually start with title, company, posted date, then JD body.
function extractBasicJobIdentity(rawText: string): Pick<
  ExtractJobInsightsResult,
  "jobTitle" | "company"
> {
  const parts = normalizeText(rawText)
    .split(/\s+(?=Posted\s+\d|\bIf\b|\bAbout\b|\bLocation\b|\bWho\b)/i)[0]
    .split(/\s{2,}|(?<=\w)\s+(?=[A-Z][A-Za-z&., Pty Ltd]+ Posted\b)/)
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const firstLineMatch = normalizeText(rawText).match(
    /^(.+?)\s+([A-Z][A-Za-z0-9&.,' -]+?)\s+Posted\s+\d/ ,
  );

  if (firstLineMatch) {
    return {
      jobTitle: firstLineMatch[1],
      company: firstLineMatch[2],
    };
  }

  return {
    jobTitle: parts[0],
    company: parts[1],
  };
}

// Stable ids let React render extracted items without using array indexes.
function makeId(prefix: string, text: string): string {
  return `${prefix}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`;
}

// Fallback category guessing based on simple text signals.
function guessCategory(text: string): RequirementCategory {
  const lowerText = text.toLowerCase();

  if (
    technicalKeywordPatterns.some((keyword) => {
      return lowerText.includes(keyword.toLowerCase());
    })
  ) {
    return "tool";
  }

  if (
    lowerText.includes("communication") ||
    lowerText.includes("time management") ||
    lowerText.includes("self-motivated") ||
    lowerText.includes("problem-solving")
  ) {
    return "skill";
  }

  if (
    lowerText.includes("citizenship") ||
    lowerText.includes("permanent residency") ||
    lowerText.includes("required")
  ) {
    return "qualification";
  }

  if (
    lowerText.includes("support") ||
    lowerText.includes("configuration") ||
    lowerText.includes("implementation") ||
    lowerText.includes("build")
  ) {
    return "responsibility";
  }

  return "other";
}

// Pull likely requirement sentences from sections such as "Key skills required".
function splitRequirementCandidates(rawText: string): string[] {
  const normalizedText = normalizeText(rawText);
  const headingPattern = requirementHeadings.join("|");
  const sections = normalizedText.split(new RegExp(`(${headingPattern})`, "i"));
  const candidates = new Set<string>();

  sections.forEach((section, index) => {
    const previousPart = sections[index - 1]?.toLowerCase() ?? "";
    const isRelevantSection = requirementHeadings.some((heading) => {
      return previousPart.includes(heading) || section.toLowerCase().includes(heading);
    });

    if (!isRelevantSection) {
      return;
    }

    section
      .split(/(?<=[.!?])\s+|(?=\b[A-Z][a-z]+(?:\s+[a-z]+){0,4}:)/)
      .map((part) => normalizeText(part.replace(/^[•\-–]\s*/, "")))
      .filter((part) => part.length >= 24 && part.length <= 220)
      .forEach((part) => candidates.add(part));
  });

  return Array.from(candidates).slice(0, 12);
}

// Find known technical keywords directly inside the raw JD text.
function extractTechnicalKeywords(rawText: string): ExtractedRequirement[] {
  const lowerText = rawText.toLowerCase();

  return technicalKeywordPatterns
    .filter((keyword) => lowerText.includes(keyword.toLowerCase()))
    .map((keyword) => ({
      id: makeId("keyword", keyword),
      text: keyword,
      category: "tool" as const,
      importance: "high" as const,
      evidence: keyword,
    }));
}

// Convert sentence candidates into the shared ExtractedRequirement shape.
function extractRequirementItems(rawText: string): ExtractedRequirement[] {
  return splitRequirementCandidates(rawText).map((text) => ({
    id: makeId("requirement", text),
    text,
    category: guessCategory(text),
    importance: "medium",
    evidence: text,
  }));
}

// Public fallback extractor used before AI enrichment.
export function extractJobInsights(rawText: string): ExtractJobInsightsResult {
  const identity = extractBasicJobIdentity(rawText);
  const requirements = extractRequirementItems(rawText);
  const keywords = extractTechnicalKeywords(rawText);
  const confidence = requirements.length > 0 || keywords.length > 0 ? 0.65 : 0.25;

  return {
    ...identity,
    requirements,
    keywords,
    confidence,
  };
}

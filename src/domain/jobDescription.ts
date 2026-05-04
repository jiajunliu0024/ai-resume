export type RequirementCategory =
  | "skill"
  | "tool"
  | "experience"
  | "responsibility"
  | "qualification"
  | "other";

export type ExtractedRequirement = {
  id: string;
  text: string;
  category: RequirementCategory;
  importance: "high" | "medium" | "low";
  evidence: string;
};

export type JobDescription = {
  title: string;
  company: string;
  sourceUrl: string;
  rawText: string;
  requirements: ExtractedRequirement[];
  keywords: ExtractedRequirement[];
  confidence: number;
};

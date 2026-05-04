export type ResumeBasicInfo = {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
};

export type ResumeExperienceItem = {
  id: string;
  title: string;
  company: string;
  dates: string;
  location: string;
  achievements: string[];
};

export type ResumeProjectItem = {
  id: string;
  name: string;
  technologies: string;
  description: string;
  highlights: string[];
};

export type ResumeEducationItem = {
  id: string;
  degree: string;
  school: string;
  dates: string;
  details: string;
};

export type Resume = {
  id: string;
  title: string;
  rawText: string;
  basicInfo?: string;
  basicInfoFields?: ResumeBasicInfo;
  summary?: string;
  skills?: string;
  experience?: string;
  experienceItems?: ResumeExperienceItem[];
  projects?: string;
  projectItems?: ResumeProjectItem[];
  education?: string;
  educationItems?: ResumeEducationItem[];
  certifications?: string;
  parseStatus?: "parsed" | "fallback" | "failed";
  parseSource?: "ai" | "local";
  parsedAt?: string;
  parserVersion?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResumeRewriteSuggestion = {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  matchedRequirementIds: string[];
};

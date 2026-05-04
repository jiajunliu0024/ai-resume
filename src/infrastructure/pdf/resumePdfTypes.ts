import type { Resume, ResumeBasicInfo, ResumeEducationItem } from "../../domain/resume";

export const RESUME_PDF_TEMPLATE_IDS = ["professional", "minimal", "modern"] as const;
export type ResumePdfTemplateId = (typeof RESUME_PDF_TEMPLATE_IDS)[number];

export const RESUME_PDF_TEMPLATES: {
  id: ResumePdfTemplateId;
  name: string;
  description: string;
}[] = [
  {
    id: "professional",
    name: "Professional",
    description: "Blue section accents and clear hierarchy (closest to a classic résumé PDF).",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Light gray headers, compact spacing, ATS-friendly simplicity.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Dark header band with inverted contact strip.",
  },
];

export type GenerateResumePdfInput = {
  resume: Resume;
  basicInfo: ResumeBasicInfo;
  educationItems: ResumeEducationItem[];
  selectedSkills: string[];
};

export function isResumePdfTemplateId(value: string): value is ResumePdfTemplateId {
  return (RESUME_PDF_TEMPLATE_IDS as readonly string[]).includes(value);
}

import type { Resume, ResumeBasicInfo, ResumeEducationItem } from "../../domain/resume";
import {
  isResumeRenderTemplateId,
  RESUME_RENDER_TEMPLATE_IDS,
  RESUME_RENDER_TEMPLATES,
  type ResumeRenderTemplateId,
} from "../../shared/resumeRenderTemplates";

/** PDF layout IDs — shared catalog in `shared/resumeRenderTemplates.ts`. */
export const RESUME_PDF_TEMPLATE_IDS = RESUME_RENDER_TEMPLATE_IDS;
export type ResumePdfTemplateId = ResumeRenderTemplateId;

export const RESUME_PDF_TEMPLATES = RESUME_RENDER_TEMPLATES.map(({ id, name, description }) => ({
  id,
  name,
  description,
}));

export type GenerateResumePdfInput = {
  resume: Resume;
  basicInfo: ResumeBasicInfo;
  educationItems: ResumeEducationItem[];
  selectedSkills: string[];
};

export function isResumePdfTemplateId(value: string): value is ResumePdfTemplateId {
  return isResumeRenderTemplateId(value);
}

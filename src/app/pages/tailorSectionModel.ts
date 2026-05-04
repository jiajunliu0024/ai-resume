import { type Resume } from "../../domain/resume";

/** Mirrors structured resume JSON keys; UI lists only sections with content. */
export type TailorSectionId =
  | "basicInfo"
  | "skills"
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "certifications";

export function educationHasContent(resume: Resume): boolean {
  if (resume.education?.trim()) {
    return true;
  }

  return Boolean(
    resume.educationItems?.some(
      (item) =>
        item.degree.trim() ||
        item.school.trim() ||
        item.dates.trim() ||
        item.details.trim(),
    ),
  );
}

export function experienceHasContent(resume: Resume): boolean {
  if (resume.experience?.trim()) {
    return true;
  }

  return Boolean(
    resume.experienceItems?.some(
      (item) =>
        item.title.trim() ||
        item.company.trim() ||
        item.dates.trim() ||
        item.location.trim() ||
        item.achievements.some((a) => a.trim()),
    ),
  );
}

export function projectsHasContent(resume: Resume): boolean {
  if (resume.projects?.trim()) {
    return true;
  }

  return Boolean(
    resume.projectItems?.some(
      (item) =>
        item.name.trim() ||
        item.technologies.trim() ||
        item.description.trim() ||
        item.highlights.some((h) => h.trim()),
    ),
  );
}

export function getVisibleTailorSections(
  resume: Resume,
  skillChips: string[],
): TailorSectionId[] {
  const sections: TailorSectionId[] = ["basicInfo"];

  if (skillChips.length > 0 || Boolean(resume.skills?.trim())) {
    sections.push("skills");
  }

  if (resume.summary?.trim()) {
    sections.push("summary");
  }

  if (experienceHasContent(resume)) {
    sections.push("experience");
  }

  if (projectsHasContent(resume)) {
    sections.push("projects");
  }

  if (educationHasContent(resume)) {
    sections.push("education");
  }

  if (resume.certifications?.trim()) {
    sections.push("certifications");
  }

  return sections;
}

export function previewSnippet(text: string, maxLength: number) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

export const TAILOR_SECTION_LABELS: Record<TailorSectionId, string> = {
  basicInfo: "Basic Info",
  skills: "Skills",
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
};

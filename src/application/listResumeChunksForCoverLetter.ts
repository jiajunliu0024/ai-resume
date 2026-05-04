import { parseResumeSections } from "./parseResumeSections";
import type { Resume, ResumeEducationItem, ResumeExperienceItem, ResumeProjectItem } from "../domain/resume";

export type CoverLetterResumeChunk = {
  id: string;
  label: string;
  body: string;
};

function formatBasicInfoBlock(resume: Resume, parsed: ReturnType<typeof parseResumeSections>): string {
  const fields = resume.basicInfoFields ?? parsed.basicInfoFields;
  const lines = [
    fields.name,
    fields.email,
    fields.phone,
    fields.location,
    fields.links.filter(Boolean).join(", "),
  ].filter(Boolean);
  return lines.join("\n").trim();
}

function formatExperienceItem(item: ResumeExperienceItem): string {
  const head = [item.title, item.company, item.dates, item.location].filter(Boolean).join(" | ");
  const bullets = item.achievements.map((a) => a.trim()).filter(Boolean);
  return [head, ...bullets.map((b) => `• ${b}`)].filter(Boolean).join("\n").trim();
}

function formatProjectItem(item: ResumeProjectItem): string {
  const head = [item.name, item.technologies].filter(Boolean).join(" — ");
  const lines = [head, item.description.trim(), ...item.highlights.map((h) => `• ${h.trim()}`)].filter(
    Boolean,
  );
  return lines.join("\n").trim();
}

function formatEducationItem(item: ResumeEducationItem): string {
  return [item.degree, item.school, item.dates, item.details].filter(Boolean).join("\n").trim();
}

/**
 * Discrete resume snippets the user can include in the cover letter prompt.
 * IDs are stable for the lifetime of the current resume object (use resume.updatedAt in React deps).
 */
export function listResumeChunksForCoverLetter(resume: Resume | null): CoverLetterResumeChunk[] {
  if (!resume) {
    return [];
  }

  const parsed = parseResumeSections(resume.rawText);
  const out: CoverLetterResumeChunk[] = [];

  const basic = formatBasicInfoBlock(resume, parsed);
  if (basic) {
    out.push({ id: "resume-basic", label: "Contact & header", body: basic });
  }

  const summary = (resume.summary ?? parsed.summary ?? "").trim();
  if (summary) {
    out.push({ id: "resume-summary", label: "Professional summary", body: summary });
  }

  const skills = (resume.skills ?? parsed.skills ?? "").trim();
  if (skills) {
    out.push({ id: "resume-skills", label: "Skills", body: skills });
  }

  const experienceItems =
    resume.experienceItems?.length ? resume.experienceItems : parsed.experienceItems;

  for (const item of experienceItems) {
    const body = formatExperienceItem(item);
    if (body) {
      const label = [item.title, item.company].filter(Boolean).join(" · ") || "Experience";
      out.push({ id: `resume-exp-${item.id}`, label, body });
    }
  }

  const projectItems = resume.projectItems?.length ? resume.projectItems : parsed.projectItems;
  for (const item of projectItems) {
    const body = formatProjectItem(item);
    if (body) {
      out.push({
        id: `resume-proj-${item.id}`,
        label: item.name.trim() || "Project",
        body,
      });
    }
  }

  const educationItems =
    resume.educationItems?.length ? resume.educationItems : parsed.educationItems;

  for (const item of educationItems) {
    const body = formatEducationItem(item);
    if (body) {
      out.push({
        id: `resume-edu-${item.id}`,
        label: [item.degree, item.school].filter(Boolean).join(" · ") || "Education",
        body,
      });
    }
  }

  const certs = (resume.certifications ?? parsed.certifications ?? "").trim();
  if (certs) {
    out.push({ id: "resume-certifications", label: "Certifications", body: certs });
  }

  return out;
}

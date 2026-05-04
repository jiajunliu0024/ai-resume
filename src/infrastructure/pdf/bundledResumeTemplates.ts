/**
 * Static PDFs shipped with the extension (from `public/resume-templates/`).
 * Used for design reference preview — not auto-filled with user data.
 */
export type BundledResumeTemplateId = "tammy-resume" | "jiajun-liu-resume-sd";

export type BundledResumeTemplate = {
  id: BundledResumeTemplateId;
  label: string;
  /** Path relative to the extension root (Vite emits `public/` at dist root). */
  pdfPath: string;
  /** Suggested download filename. */
  downloadFileName: string;
};

export const BUNDLED_RESUME_TEMPLATES: BundledResumeTemplate[] = [
  {
    id: "tammy-resume",
    label: "Tammy résumé (static PDF)",
    pdfPath: "resume-templates/tammy-resume.pdf",
    downloadFileName: "tammy-resume-template.pdf",
  },
  {
    id: "jiajun-liu-resume-sd",
    label: "Jiajun Liu — SD layout (static PDF)",
    pdfPath: "resume-templates/jiajun-liu-resume-sd.pdf",
    downloadFileName: "jiajun-liu-resume-sd-template.pdf",
  },
];

export function isBundledResumeTemplateId(value: string): value is BundledResumeTemplateId {
  return BUNDLED_RESUME_TEMPLATES.some((item) => item.id === value);
}

/** Resolve URL for iframe / download in extension popup or Vite dev. */
export function bundledResumeTemplatePdfUrl(pdfPath: string): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(pdfPath);
  }

  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${pdfPath}`;
}

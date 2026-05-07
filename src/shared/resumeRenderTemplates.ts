/**
 * Résumé PDF template catalog for @react-pdf — one ID per visual layout in `ResumePdfDocument`.
 */
export const RESUME_RENDER_TEMPLATE_IDS = [
  "classic-sample",
  "minimal-clean",
  "plain-sections",
  "serif-formal",
  "sans-modern",
  "compact-10pt",
  "ruled-navy",
] as const;

export type ResumeRenderTemplateId = (typeof RESUME_RENDER_TEMPLATE_IDS)[number];

export const RESUME_RENDER_TEMPLATES: {
  id: ResumeRenderTemplateId;
  name: string;
  description: string;
  inspiredBy?: string;
}[] = [
  {
    id: "classic-sample",
    name: "Classic (project sample.tex)",
    description:
      "Classic header, navy section accents — closest to a traditional one-column résumé PDF.",
    inspiredBy: "Professional single-column résumés.",
  },
  {
    id: "minimal-clean",
    name: "Minimal (fewer packages)",
    description: "Light gray section titles, compact spacing, ATS-friendly simplicity.",
    inspiredBy: "Minimal résumé PDFs.",
  },
  {
    id: "plain-sections",
    name: "Plain sections",
    description: "Bold section titles with a strong horizontal rule.",
    inspiredBy: "ATS-oriented single-column layouts (conceptually similar to simple moderncv banking variants).",
  },
  {
    id: "serif-formal",
    name: "Serif formal",
    description: "Times-like serif body for a formal résumé look.",
    inspiredBy: "Traditional academic / consulting résumés.",
  },
  {
    id: "sans-modern",
    name: "Sans modern",
    description: "Sans-serif body with a dark header band.",
    inspiredBy: "Tech and product résumés with a contemporary UI feel.",
  },
  {
    id: "compact-10pt",
    name: "Compact 10pt",
    description: "Smaller type and tighter margins for dense one-page layouts.",
    inspiredBy: "Single-page ATS layouts that must fit more lines.",
  },
  {
    id: "ruled-navy",
    name: "Ruled navy",
    description: "Navy section titles and matching accent rules.",
    inspiredBy: "Brand-accent CV styling while staying machine-readable.",
  },
];

export function isResumeRenderTemplateId(value: string): value is ResumeRenderTemplateId {
  return (RESUME_RENDER_TEMPLATE_IDS as readonly string[]).includes(value);
}

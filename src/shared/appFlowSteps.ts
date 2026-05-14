/**
 * Single source of truth for the four-step flow: progress strip labels match page titles.
 */
export const APP_FLOW_STEP_ORDER = ["scan", "resume", "tailor", "results"] as const;

export type AppFlowStepId = (typeof APP_FLOW_STEP_ORDER)[number];

export const APP_FLOW_STEPS: Record<
  AppFlowStepId,
  { label: string; pageSubtitle: string }
> = {
  scan: {
    label: "Scan job",
    pageSubtitle:
      "Read the job posting from the active browser tab and extract requirements and keywords with AI. No prior step — add an API key in Settings before scanning.",
  },
  resume: {
    label: "Resume",
    pageSubtitle:
      "Upload or choose a parsed resume as the base for tailoring. Uses the job title and scan from Scan job when you continue from that step.",
  },
  tailor: {
    label: "Tailor",
    pageSubtitle:
      "Align your resume to the scanned job: edit sections and run AI rewrites. Needs a resume from Resume and the latest scan from Scan job.",
  },
  results: {
    label: "Cover letter",
    pageSubtitle:
      "Pick JD keywords, requirements, and resume excerpts, then generate a letter you can copy or download. Uses the scanned job and selected resume from the earlier steps.",
  },
};

export const APP_STEP_PROGRESS_LABELS = APP_FLOW_STEP_ORDER.map(
  (id) => APP_FLOW_STEPS[id].label,
);

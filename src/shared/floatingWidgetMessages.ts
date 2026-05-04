/**
 * Posted from embedded app iframe to the host page; content script minimizes the floating panel.
 * The floating widget content script duplicates this string (no imports) so injection stays one file.
 */
export const RESUME_TAILOR_MINIMIZE_PANEL = "RESUME_TAILOR_MINIMIZE_PANEL" as const;

export type ResumeTailorMinimizeMessage = {
  type: typeof RESUME_TAILOR_MINIMIZE_PANEL;
};

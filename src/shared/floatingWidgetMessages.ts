/**
 * Posted from embedded app iframe to the host page; content script minimizes the floating panel.
 * The floating widget content script duplicates this string (no imports) so injection stays one file.
 */
export const RESUME_TAILOR_MINIMIZE_PANEL = "RESUME_TAILOR_MINIMIZE_PANEL" as const;

/** App / popup asks the service worker to scan the job tab and return page text. */
export const RESUME_TAILOR_READ_ACTIVE_TAB_TEXT =
  "RESUME_TAILOR_READ_ACTIVE_TAB_TEXT" as const;

export type ResumeTailorMinimizeMessage = {
  type: typeof RESUME_TAILOR_MINIMIZE_PANEL;
  /** Host job tab when the UI runs inside the injected floating iframe. */
  tabId?: number;
};

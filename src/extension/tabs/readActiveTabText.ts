export type ActiveTabText = {
  title: string;
  url: string;
  text: string;
  debugLog: string;
};

// This function is injected into the active web page.
// Important: everything it uses must live inside this function because
// chrome.scripting.executeScript does not carry outer helper functions with it.
function extractTextFromCurrentDocument(): ActiveTabText {
  // Common selectors used by job boards and drawer-style job description panels.
  const jobDetailSelectors = [
    "[data-automation='jobAdDetails']",
    "[data-automation='job-detail-page']",
    "[data-automation='jobDescription']",
    "[data-automation='job-details']",
    "[data-testid='job-details']",
    "[data-testid='job-description']",
    "[aria-label*='Job details' i]",
    "[aria-label*='Job description' i]",
    "section[class*='job' i]",
    "div[class*='job-description' i]",
    "div[class*='jobDescription' i]",
    "div[class*='description' i]",
    "aside",
    "[role='dialog']",
    "[role='complementary']",
    "article",
    "main",
  ];

  type Candidate = {
    selector: string;
    index: number;
    isVisible: boolean;
    length: number;
    score: number;
    text: string;
  };

  // Higher priority selectors can beat document.body even if body has more text.
  // This is important for SEEK apply pages where the JD is inside a dialog.
  const selectorPriority: Record<string, number> = {
    "[data-automation='jobAdDetails']": 10000,
    "[data-automation='job-detail-page']": 10000,
    "[data-automation='jobDescription']": 10000,
    "[data-automation='job-details']": 10000,
    "[data-testid='job-details']": 9500,
    "[data-testid='job-description']": 9500,
    "[aria-label*='Job details' i]": 9000,
    "[aria-label*='Job description' i]": 9000,
    "[role='dialog']": 8500,
    "aside": 7000,
    "[role='complementary']": 6500,
    "section[class*='job' i]": 6000,
    "div[class*='job-description' i]": 6000,
    "div[class*='jobDescription' i]": 6000,
    "div[class*='description' i]": 5000,
    article: 3500,
    main: 2500,
    "document.body": -5000,
  };

  // Collapse whitespace so AI receives clean text instead of layout artifacts.
  function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  // Ignore hidden DOM nodes and offscreen templates.
  function isVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  // innerText reflects visible text better than textContent when available.
  function getElementText(element: Element): string {
    return normalizeText(
      (element as HTMLElement).innerText ?? element.textContent ?? "",
    );
  }

  // Score a candidate container by selector priority, text length, job signals,
  // and penalties for application-form noise.
  function scoreJobText(text: string, selector: string): number {
    const lowerText = text.toLowerCase();
    const jobSignals = [
      "about the role",
      "about this role",
      "responsibilities",
      "requirements",
      "skills",
      "experience",
      "qualification",
      "benefits",
      "salary",
      "apply",
    ];
    const nonJobSignals = [
      "choose documents",
      "select a resumé",
      "upload a resumé",
      "cover letter",
      "review and submit",
      "update seek profile",
    ];

    const signalScore = jobSignals.reduce((score, signal) => {
      return lowerText.includes(signal) ? score + 500 : score;
    }, 0);
    const noisePenalty = nonJobSignals.reduce((score, signal) => {
      return lowerText.includes(signal) ? score + 800 : score;
    }, 0);
    const priorityScore = selectorPriority[selector] ?? 0;

    return priorityScore + Math.min(text.length, 3500) + signalScore - noisePenalty;
  }

  // Collect all possible JD containers so we can debug why one was selected.
  function collectCandidates(): Candidate[] {
    const seenElements = new Set<Element>();
    const candidates: Candidate[] = [];

    jobDetailSelectors.forEach((selector) => {
      Array.from(document.querySelectorAll(selector)).forEach(
        (element, index) => {
          if (seenElements.has(element)) {
            return;
          }

          seenElements.add(element);

          const text = getElementText(element);
          const visible = isVisible(element);

          candidates.push({
            selector,
            index,
            isVisible: visible,
            length: text.length,
            score: visible ? scoreJobText(text, selector) : 0,
            text,
          });
        },
      );
    });

    // document.body is the final fallback. It is noisy, so scoring downgrades it.
    const bodyText = getElementText(document.body);
    candidates.push({
      selector: "document.body",
      index: 0,
      isVisible: isVisible(document.body),
      length: bodyText.length,
      score: scoreJobText(bodyText, "document.body"),
      text: bodyText,
    });

    return candidates;
  }

  // Produce a downloadable log for debugging job sites with unusual DOMs.
  function buildDebugLog(candidates: Candidate[], selected: Candidate): string {
    const lines = [
      `Scan time: ${new Date().toISOString()}`,
      `Page title: ${document.title}`,
      `Page URL: ${window.location.href}`,
      `Total candidates: ${candidates.length}`,
      "",
      `Selected selector: ${selected.selector}`,
      `Selected index: ${selected.index}`,
      `Selected visible: ${String(selected.isVisible)}`,
      `Selected length: ${selected.length}`,
      `Selected score: ${selected.score}`,
      `Selected preview: ${selected.text.slice(0, 1200)}`,
      "",
      "Selected full text:",
      selected.text,
      "",
      "All candidates:",
    ];

    candidates
      .slice()
      .sort((left, right) => right.score - left.score)
      .forEach((candidate, index) => {
        lines.push("");
        lines.push(`Candidate #${index + 1}`);
        lines.push(`selector: ${candidate.selector}`);
        lines.push(`index: ${candidate.index}`);
        lines.push(`visible: ${String(candidate.isVisible)}`);
        lines.push(`length: ${candidate.length}`);
        lines.push(`score: ${candidate.score}`);
        lines.push(`preview: ${candidate.text.slice(0, 1200)}`);
      });

    return lines.join("\n");
  }

  // Pick the highest-scoring visible candidate with enough content.
  const candidates = collectCandidates();
  const selectableCandidates = candidates.filter((candidate) => {
    return candidate.isVisible && candidate.length > 200;
  });
  const selected =
    selectableCandidates.sort((left, right) => right.score - left.score)[0] ??
    candidates[candidates.length - 1];

  // The selected text becomes the raw JD passed to OpenAI.
  return {
    title: document.title,
    url: window.location.href,
    text: selected.text || normalizeText(document.body.innerText),
    debugLog: buildDebugLog(candidates, selected),
  };
}

// Chrome-side adapter:
// finds the active tab, injects the DOM extractor, and returns extracted text.
export async function readActiveTabText(): Promise<ActiveTabText> {
  if (!globalThis.chrome?.tabs || !globalThis.chrome.scripting) {
    throw new Error("Chrome extension APIs are not available.");
  }

  const [activeTab] = await globalThis.chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    throw new Error("No active tab was found.");
  }

  const [injectionResult] = await globalThis.chrome.scripting
    .executeScript({
      target: { tabId: activeTab.id },
      func: extractTextFromCurrentDocument,
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown script error.";
      throw new Error(`Could not inject scan script: ${message}`);
    });

  if (!injectionResult?.result) {
    throw new Error("Could not read text from the active tab.");
  }

  return injectionResult.result;
}

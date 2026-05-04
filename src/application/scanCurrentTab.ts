import { scanJobPage, type ScanJobPageResult } from "./scanJobPage";

// PageTextReader is injected into this use case.
// This keeps application logic independent from Chrome-specific APIs.
export type PageTextReader = () => Promise<{
  title: string;
  url: string;
  text: string;
  debugLog?: string;
}>;

export async function scanCurrentTab(
  readPageText: PageTextReader,
): Promise<ScanJobPageResult> {
  // The reader returns raw information from the active browser tab.
  const page = await readPageText();

  // scanJobPage converts raw page data into the internal job description shape.
  return scanJobPage({
    pageTitle: page.title,
    pageText: page.text,
    sourceUrl: page.url,
    debugLog: page.debugLog,
  });
}

# Sequence Diagrams

Step-by-step call order for main flows. Companion to [ARCHITECTURE.md](./ARCHITECTURE.md) (layers and dependencies).

**Legend:** Solid calls stay in the extension; dashed arrows are **HTTPS to the user’s AI provider** (API key from local storage, no custom backend).

---

## Index

| # | Flow | Trigger |
|---|------|---------|
| [1](#1-app-startup-load-local-settings) | App startup | Extension UI opens |
| [2](#2-scan-job-page) | Scan job page | User clicks scan on Scan step |
| [3](#3-parse-resume-pdf) | Parse resume PDF | User uploads PDF on Resume step |
| [4](#4-generate-cover-letter) | Generate cover letter | User clicks generate on Results step |
| [5](#5-tailor-ai-rewrite-segment) | Tailor AI rewrite | User opens rewriter on Tailor step |
| [6](#6-floating-widget-minimize-panel) | Minimize floating panel | User minimizes embedded UI (optional) |

---

## 1. App startup (load local settings)

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as app/App.tsx
  participant Store as infrastructure/chromeStorageRepository

  User->>UI: Open extension popup / side panel
  activate UI

  par Load persisted state
    UI->>Store: getItem(apiKey)
    Store-->>UI: apiKey?
    UI->>Store: getItem(aiProvider)
    Store-->>UI: provider?
    UI->>Store: getItem(currentResume)
    Store-->>UI: resume?
    UI->>Store: getItem(resumes[])
    Store-->>UI: resumes?
  end

  UI-->>User: Show Scan step (or embedded floating widget)
  deactivate UI
```

---

## 2. Scan job page

Orchestrated in `App.handleScanCurrentPage`: tab text → local JD shape → AI enrichment → `chrome.storage.local`.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Scan as app/ScanPage
  participant App as app/App.tsx
  participant UC as application/scanCurrentTab
  participant Tab as extension/readActiveTabText
  participant Chrome as Chrome APIs
  participant Page as Job board tab (injected fn)
  participant Job as application/scanJobPage
  participant Heur as application/extractJobInsights
  participant AI as infrastructure/openAiJobInsightsExtractor
  participant Provider as AI provider API
  participant Store as chromeStorageRepository

  User->>Scan: Click Scan Job Page
  Scan->>App: handleScanCurrentPage()

  alt No API key
    App-->>User: Open Settings
  else Has API key
    App->>App: setIsScanning(true)

    App->>UC: scanCurrentTab(readActiveTabText)
    UC->>Tab: readActiveTabText()
    Tab->>Chrome: tabs.query(active)
    Chrome-->>Tab: tabId
    Tab->>Chrome: scripting.executeScript(extractTextFromCurrentDocument)
    Chrome->>Page: Run DOM scorer in page
    Page-->>Chrome: title, url, text, debugLog
    Chrome-->>Tab: ActiveTabText
    Tab-->>UC: page snapshot

    UC->>Job: scanJobPage({ pageTitle, pageText, sourceUrl, debugLog })
    Job->>Heur: extractJobInsights(pageText)
    Heur-->>Job: requirements, keywords, company (heuristic)
    Job-->>UC: ScanJobPageResult (local fallback)
    UC-->>App: result

    App->>AI: extractJobInsightsWithAiProvider(rawText, apiKey, provider)
    AI->>Provider: POST chat/completions (JSON)
    Provider-->>AI: jobTitle, company, requirements, keywords
    AI-->>App: ExtractJobInsightsResult

    App->>App: Merge AI into result → setScannedJob
    App->>Store: setItem(currentJobDescription)
    App->>App: setIsScanning(false)
    App-->>User: ScanPage shows JD, requirements, keywords
  end
```

**Notes**

- `extractJobInsights` runs inside `scanJobPage` before AI; the UI **replaces** requirements/keywords with the provider response.
- Raw JD text is never sent to a project-owned server—only to the provider the user configured.

---

## 3. Parse resume PDF

Entry: `ResumePage` → `application/parseResume`. Three paths: vision AI, plain-text AI, local sections.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Resume as app/ResumePage
  participant App as app/App.tsx
  participant UC as application/parseResume
  participant PDF as infrastructure/pdfResumeParser
  participant AIParse as infrastructure/aiResumeParser
  participant Sections as application/parseResumeSections
  participant Provider as AI provider API
  participant Store as chromeStorageRepository

  User->>Resume: Choose PDF file(s)
  Resume->>Resume: Validate API key + PDF type

  Resume->>UC: parseResume(title, file, { apiKey, aiProvider })

  par Extract in parallel
    UC->>PDF: extractTextFromPdf(file)
    PDF-->>UC: rawText
    opt Vision-capable provider
      UC->>PDF: renderPdfPagesToImageDataUrls(file)
      PDF-->>UC: pageImages[]
    end
  end

  alt Vision path (OpenAI / Gemini + images)
    UC->>AIParse: parseResumeWithAiProviderFromPdfPageImages(images, key, provider)
    AIParse->>Provider: POST (vision + JSON resume shape)
    Provider-->>AIParse: sections
    AIParse-->>UC: ParsedResumeSections
    UC-->>Resume: Resume (parseSource: ai)
  else Plain-text AI path
    UC->>AIParse: parseResumeWithAiProviderFromPlainText(rawText, key, provider)
    AIParse->>Provider: POST (text + JSON resume shape)
    Provider-->>AIParse: sections
    AIParse-->>UC: ParsedResumeSections
    UC-->>Resume: Resume (parseSource: ai)
  else Local fallback
    UC->>Sections: parseResumeSections(rawText)
    Sections-->>UC: ParsedResumeSections
    UC-->>Resume: Resume (parseSource: local)
  end

  Resume->>App: onResumesAdd(resumes)
  App->>Store: setItem(currentResume), setItem(resumes[])
  App-->>User: Resume list updated; can continue to Tailor
```

---

## 4. Generate cover letter

Entry: `ResultsPage.handleGenerate` → `application/generateCoverLetter`.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Results as app/ResultsPage
  participant UC as application/generateCoverLetter
  participant Chunks as application/listResumeChunksForCoverLetter
  participant Sections as application/parseResumeSections
  participant AI as infrastructure/openAiCoverLetterGenerator
  participant Provider as AI provider API

  User->>Results: Select keywords / requirements / resume chunks
  User->>Results: Click Generate cover letter

  alt Missing job, resume, API key, or selection
    Results-->>User: Error or open Settings
  else Ready
    Results->>UC: generateCoverLetter({ job, resume, selectedIds, apiKey, providerId })

    UC->>UC: Filter job.keywords / job.requirements by selection
    UC->>Chunks: listResumeChunksForCoverLetter(resume)
    Chunks->>Sections: parseResumeSections(resume fields)
    Sections-->>Chunks: chunk list
    Chunks-->>UC: selected resumeBlocks

    UC->>AI: generateCoverLetterWithAiProvider(prompt input)
    AI->>Provider: POST chat/completions
    Provider-->>AI: letter text (JSON)
    AI-->>UC: string
    UC-->>Results: CoverLetter { id, content, createdAt }

    Results->>Results: setCoverLetter(state)
    Results-->>User: Show letter; Copy / Download PDF

    opt Download PDF
      User->>Results: Download PDF
      Results->>Results: generateCoverLetterPdfBlob (infrastructure/pdf)
      Results->>Results: downloadBlob (infrastructure/export)
    end
  end
```

---

## 5. Tailor AI rewrite segment

Entry: `TailorAiRewriterDialog` on Tailor step. Rewrites summary or one experience bullet.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Tailor as app/TailorPage
  participant Dialog as app/TailorAiRewriterDialog
  participant UC as application/rewriteTailorResumeSegment
  participant AI as infrastructure/tailorSegmentRewriter
  participant Provider as AI provider API

  User->>Tailor: Edit section → Open AI rewriter
  Tailor->>Dialog: Open with job + originalText + context

  User->>Dialog: Pick keywords / requirements
  User->>Dialog: Generate / Regenerate

  Dialog->>UC: rewriteTailorResumeSegment({ originalText, keywords, requirements, apiKey, providerId })
  UC->>AI: rewriteTailorResumeSegment (infra)
  AI->>Provider: POST chat/completions
  Provider-->>AI: rewritten text + metadata
  AI-->>UC: TailorSegmentRewriteOutcome
  UC-->>Dialog: outcome

  Dialog-->>User: Show suggestion in dialog

  opt User applies
    User->>Dialog: Apply
    Dialog->>Tailor: onApply(rewritten)
    Tailor->>Tailor: Update local resume state (TailorPage)
  end
```

**Note:** Tailor edits are held in React state on `TailorPage` until the user saves or navigates; PDF preview uses `infrastructure/pdf` separately (not shown).

---

## 6. Floating widget: minimize panel

Used when the app runs inside the injected floating iframe (`?embed=floating-widget`). Some sites block direct `postMessage` from iframe → widget, so the service worker relays.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Iframe as app (embedded)
  participant BG as extension/background.ts
  participant Widget as extension/floatingWidget.ts (content script)

  User->>Iframe: Minimize panel
  Iframe->>BG: chrome.runtime.sendMessage({ type: RESUME_TAILOR_MINIMIZE_PANEL, tabId })

  BG->>Widget: chrome.tabs.sendMessage(tabId, { type: RESUME_TAILOR_MINIMIZE_PANEL })
  Widget->>Widget: Collapse / hide widget UI
  Widget-->>User: Panel minimized on page
```

Constants are duplicated in `shared/floatingWidgetMessages.ts` and extension bundles (no cross-import) so `executeScript` stays a single file.

---

## End-to-end user journey (four steps)

High-level only—see sections above for call detail.

```mermaid
sequenceDiagram
  actor User
  participant App as app (4 steps)
  participant UC as application
  participant Ext as extension
  participant AI as AI provider

  User->>App: ① Scan
  App->>Ext: Read active tab JD
  App->>UC: scanCurrentTab → scanJobPage
  App->>AI: Enrich JD insights
  App->>App: Persist job

  User->>App: ② Resume
  App->>UC: parseResume (PDF)
  UC->>AI: Optional AI parse
  App->>App: Persist resume(s)

  User->>App: ③ Tailor
  App->>UC: parseResumeSections (local)
  User->>App: Optional segment rewrite
  App->>UC: rewriteTailorResumeSegment
  UC->>AI: Rewrite bullet/summary

  User->>App: ④ Results
  App->>UC: generateCoverLetter
  UC->>AI: Write letter
  App->>App: Copy or PDF download
```

---

## Keeping diagrams accurate

After changing orchestration, update the matching section and re-check entry files:

| Flow | Primary files |
|------|----------------|
| Scan | `app/App.tsx`, `application/scanCurrentTab.ts`, `extension/tabs/readActiveTabText.ts` |
| Parse | `app/pages/ResumePage.tsx`, `application/parseResume.ts` |
| Cover letter | `app/pages/ResultsPage.tsx`, `application/generateCoverLetter.ts` |
| Tailor rewrite | `app/components/TailorAiRewriterDialog.tsx`, `application/rewriteTailorResumeSegment.ts` |
| Widget | `extension/background/background.ts`, `extension/content/floatingWidget.ts` |

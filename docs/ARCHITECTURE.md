# Architecture: Layered View & Module Dependency Map

Generated from `src/**/*.ts(x)` import analysis. Update when you add layers or change cross-folder imports.

**Sequence diagrams (per flow):** [SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md)

## 1. Layered architecture (intended)

```mermaid
flowchart TB
  subgraph L1["Presentation"]
    app["app/<br/>React UI, pages, components"]
    ext["extension/<br/>background, content scripts, tab reader"]
  end

  subgraph L2["Application"]
    application["application/<br/>use cases: scan, parse, cover letter, tailor rewrite"]
  end

  subgraph L3["Domain"]
    domain["domain/<br/>Resume, JobDescription, CoverLetter, types"]
  end

  subgraph L4["Infrastructure"]
    infra_ai["infrastructure/ai"]
    infra_storage["infrastructure/storage"]
    infra_parser["infrastructure/parser"]
    infra_pdf["infrastructure/pdf"]
    infra_export["infrastructure/export"]
  end

  subgraph L5["Shared"]
    shared["shared/<br/>keys, flow steps, render helpers"]
  end

  app --> application
  app --> domain
  app --> ext
  app --> infra_ai
  app --> infra_storage
  app --> infra_pdf
  app --> infra_export
  app --> shared

  ext -.->|"no src imports<br/>(rollup / inject only)"| ext

  application --> domain
  application --> shared
  application --> infra_ai
  application --> infra_parser

  infra_ai --> domain
  infra_ai --> shared
  infra_pdf --> domain
  infra_pdf --> shared
  infra_parser --> infra_pdf

  classDef ideal stroke:#2e7d32,stroke-width:2px
  class application,domain ideal
```

**Intended rule:** UI and extension adapters call **application** use cases; use cases call **domain** + **infrastructure**; **domain** and **shared** do not import upward.

---

## 2. Cross-layer dependencies

Only **six** top-level folders matter. Normal flow is **down the stack**; anything else is called out as an exception.

### 2.1 Layer stack (top = callers, bottom = no upward imports)

```
  app ─────────────── React UI (popup / side panel)
    │
    ├─► application ─ use cases
    ├─► extension ─── Chrome-only adapters (tab inject, widget; no src imports)
    ├─► infrastructure  (some pages skip application — see leaks)
    ├─► domain ──────── types for props / display
    └─► shared ──────── flow labels, keys, small helpers

  application ──► domain, shared, infrastructure

  infrastructure ─► domain, shared
                    └─► application  ⚠ one reverse edge (see below)

  domain, shared ──► (nothing in src/)
  extension ───────► (nothing in src/ — constants duplicated for inject bundles)
```

### 2.2 Allowed edges (9 relationships)

| From | To | What |
|------|-----|------|
| `app` | `application` | Scan, parse, cover letter, tailor rewrite |
| `app` | `extension` | `readActiveTabText` for scan |
| `app` | `domain` | Types on pages (`Resume`, `ExtractedRequirement`, …) |
| `app` | `shared` | `storageKeys`, `appFlowSteps` |
| `application` | `domain` | All use cases |
| `application` | `shared` | e.g. `experienceAchievements` in `parseResumeSections` |
| `application` | `infrastructure` | AI parsers, PDF text extract, cover letter API |
| `infrastructure` | `domain` | AI/PDF types |
| `infrastructure` | `shared` | e.g. `resumeRenderTemplates`, `experienceAchievements` |

No other cross-folder imports exist today (except the two rows below).

### 2.3 Exceptions only (2 items)

| Kind | From | To | Detail |
|------|------|-----|--------|
| Reverse | `infrastructure/ai/openAiJobInsightsExtractor.ts` | `application/extractJobInsights.ts` | AI adapter reuses heuristic JD helpers |
| UI leak | `app` (pages/components) | `infrastructure` | Settings, PDF preview, export, some AI types — not routed through a use case |

**`app` → `infrastructure` touch points:** `App.tsx`, `SettingsPanel`, `ResumePage`, `TailorPage`, `ResultsPage`, `TailorAiRewriterDialog`, PDF preview modals.

### 2.4 One diagram (optional)

If you want a picture, use this **5-node** version only — not a full mesh.

```mermaid
flowchart TB
  app["app"]
  ext["extension<br/><small>isolated</small>"]
  uc["application"]
  infra["infrastructure"]
  base["domain + shared"]

  app --> uc
  app --> ext
  app --> base
  app -.->|leak| infra

  uc --> infra
  uc --> base

  infra --> base
  infra -.->|1 file| uc
```

**How to read:** solid = normal; dashed = exception. `extension` has no arrow to other layers (by design).

---

## 3. Application layer (use cases)

```mermaid
flowchart TB
  subgraph scan_flow["Scan flow"]
    scanCurrentTab[scanCurrentTab]
    scanJobPage[scanJobPage]
    extractJobInsights[extractJobInsights]
    scanCurrentTab --> scanJobPage
    scanJobPage --> extractJobInsights
  end

  subgraph resume_flow["Resume flow"]
    parseResume[parseResume]
    parseResumeSections[parseResumeSections]
    resumeParseStatus[resumeParseStatus]
    parseResume --> parseResumeSections
    parseResume --> resumeParseStatus
  end

  subgraph results_flow["Results / cover letter"]
    generateCoverLetter[generateCoverLetter]
    listResumeChunks[listResumeChunksForCoverLetter]
    generateCoverLetter --> listResumeChunks
    listResumeChunks --> parseResumeSections
    generateCoverLetter --> scanJobPage
  end

  subgraph tailor_flow["Tailor rewrite"]
    rewriteTailor[rewriteTailorResumeSegment]
  end

  generateResumeSuggestions[generateResumeSuggestions<br/><i>not wired to UI yet</i>]

  scanJobPage --> dom_jd[(domain/jobDescription)]
  parseResume --> dom_resume[(domain/resume)]
  generateCoverLetter --> dom_cl[(domain/coverLetter)]
  generateResumeSuggestions --> dom_jd
  generateResumeSuggestions --> dom_resume
```

| Module | Role |
|--------|------|
| `scanCurrentTab` | Orchestrates tab read + `scanJobPage` |
| `scanJobPage` | Raw page → `JobDescription` + heuristic insights |
| `extractJobInsights` | Pure/heuristic JD parsing (also used by OpenAI adapter) |
| `parseResume` | PDF/text → structured `Resume` via infra parsers + AI |
| `parseResumeSections` | Section model + `shared/experienceAchievements` |
| `resumeParseStatus` | Parser version / parsed flag |
| `generateCoverLetter` | Chunks resume + calls OpenAI cover letter |
| `listResumeChunksForCoverLetter` | Resume → prompt chunks |
| `rewriteTailorResumeSegment` | Tailor section AI rewrite |
| `generateResumeSuggestions` | Placeholder use case (interface in `aiProvider` only) |

---

## 4. Infrastructure submodules

```mermaid
flowchart TB
  subgraph ai["infrastructure/ai"]
    openAiJD[openAiJobInsightsExtractor]
    openAiCL[openAiCoverLetterGenerator]
    aiResumeParser[aiResumeParser]
    tailorRewriter[tailorSegmentRewriter]
    aiProvider[aiProvider interface]
    openAiJD --> extractJI[application/extractJobInsights]
    openAiJD --> dom
    aiResumeParser --> dom
    aiResumeParser --> shared_exp[shared/experienceAchievements]
    tailorRewriter --> dom
    openAiCL --> openAiJD
  end

  subgraph storage["infrastructure/storage"]
    chromeStorage[chromeStorageRepository]
  end

  subgraph parser["infrastructure/parser"]
    pdfResumeParser[pdfResumeParser]
    pdfResumeParser --> pdfjs[pdf/pdfjsSetup]
  end

  subgraph pdf["infrastructure/pdf"]
    resumePdfTypes[resumePdfTypes]
    genResumePdf[generateResumePdf]
    genCoverPdf[generateCoverLetterPdf]
    renderFirstPage[renderPdfUrlFirstPage]
    resumePdfTypes --> dom
    resumePdfTypes --> shared_tpl[shared/resumeRenderTemplates]
    genResumePdf --> resumePdfTypes
  end

  subgraph export["infrastructure/export"]
    downloadBlob[downloadBlob]
    downloadText[downloadTextFile]
  end

  dom[(domain)]
```

---

## 5. App → backend wiring (main UI paths)

```mermaid
flowchart TB
  App[App.tsx]

  App --> scanCurrentTab
  App --> readActiveTab[extension/readActiveTabText]
  scanCurrentTab --> readActiveTab

  App --> extractAI[infra: extractJobInsightsWithAiProvider]
  App --> chromeStorage

  ScanPage[ScanPage]
  ResumePage[ResumePage]
  TailorPage[TailorPage]
  ResultsPage[ResultsPage]

  App --> ScanPage
  App --> ResumePage
  App --> TailorPage
  App --> ResultsPage

  ResumePage --> parseResume
  TailorPage --> parseResumeSections
  TailorPage --> infra_pdf
  ResultsPage --> generateCoverLetter
  ResultsPage --> infra_export
  ResultsPage --> infra_pdf

  TailorAiRewriterDialog --> rewriteTailor
  SettingsPanel --> infra_ai
```

**Scan path:** `App` → `scanCurrentTab(readActiveTabText)` → `scanJobPage` → (optional) `extractJobInsightsWithAiProvider` in `App`.

**Resume path:** `ResumePage` → `parseResume` → `aiResumeParser` / `pdfResumeParser`.

**Results path:** `ResultsPage` → `generateCoverLetter` → `openAiCoverLetterGenerator`; PDF/export via infrastructure.

---

## 6. Extension (runtime, separate bundles)

```mermaid
flowchart LR
  subgraph popup_sidepanel["Extension UI (Vite app)"]
    AppUI[app / index.html]
  end

  subgraph service_worker["background.ts"]
    BG[message relay<br/>action click → inject widget]
  end

  subgraph injected["Injected scripts — no cross-src imports"]
    readTab[readActiveTabText<br/>DOM scoring in-tab]
    floatWidget[floatingWidget.ts]
    extractSimple[extractPageText.ts<br/>tests / simpler path]
  end

  AppUI -->|"scanCurrentTab"| readTab
  AppUI -->|"runtime.sendMessage"| BG
  BG --> floatWidget
  readTab -->|"chrome.scripting.executeScript"| JobPage[(job board tab)]
  floatWidget --> JobPage
```

---

## 7. Domain model (types only)

```mermaid
classDiagram
  class JobDescription {
    +title, company, location
    +rawText, sourceUrl
  }
  class ExtractedRequirement {
    +category, text, priority
  }
  class Resume {
    +basicInfo, experience
    +education, projects, skills
  }
  class CoverLetter {
    +body, metadata
  }
  class ResumeRewriteSuggestion {
    +section, suggestion
  }

  JobDescription --> ExtractedRequirement : insights
  Resume --> ResumeRewriteSuggestion : tailoring
```

Files: `domain/jobDescription.ts`, `domain/resume.ts`, `domain/coverLetter.ts`.

---

## 8. Shared utilities

| File | Used by |
|------|---------|
| `storageKeys.ts` | `app/App` |
| `appFlowSteps.ts` | pages, `StepProgress` |
| `experienceAchievements.ts` | `application/parseResumeSections`, `infrastructure/ai/aiResumeParser`, `app/TailorPage` |
| `resumeRenderTemplates.ts` | `infrastructure/pdf/resumePdfTypes` |
| `floatingWidgetMessages.ts` | duplicated in extension (no import) |

---

## Regenerating this map

From repo root, list cross-layer imports:

```bash
rg "from ['\"].*/(application|domain|infrastructure|shared|extension|app)/" src -g '*.{ts,tsx}'
```

Optional tooling: [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) with a rule set matching `src/{app,application,domain,infrastructure,shared,extension}`.

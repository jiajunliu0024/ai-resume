# Resume parsing: schema, PDF vision, domain, and Tailor

This document describes how structured resume data flows from a PDF file through AI (or local fallback) into Chrome storage and the Tailor UI.

## Goals

1. **Domain + schema**: Parsed output maps to `Resume` in `src/domain/resume.ts` (basic info fields, skills, experience items, projects, education, certifications).
2. **AI path (OpenAI)**: The extension does **not** put PDF text extraction into the AI chat message. It renders each PDF page to raster images (JPEG/PNG data URLs) and sends those images plus a JSON-schema prompt so the model reads **layout and typography** like a human.
3. **Local fallback**: If AI is unavailable (no key, wrong provider, network error), `extractTextFromPdf` runs and `parseResumeSections` fills the same domain-shaped structure from plain text.
4. **Tailor**: `TailorPage` loads the persisted `Resume`, edits structured fields, and can show debug JSON.

## (a) Implementation method

| Layer | Responsibility |
|--------|----------------|
| **UI** | `ResumePage` uploads `File`, shows status, calls `parseResume(title, file, options)`. |
| **Application** | `parseResume` orchestrates: optional vision AI → else local `parseResumeSections`; builds `Resume` via `buildResume`. |
| **Infrastructure** | `extractTextFromPdf`, `renderPdfPagesToImageDataUrls` (pdf.js + canvas); `parseResumeWithAiProviderFromPdfPageImages` (OpenAI chat completions, multimodal `content` array). |
| **Domain** | `Resume`, `ResumeExperienceItem`, etc. Single source of truth for persisted shape. |

**PDF → AI (OpenAI):** Chat Completions does not accept raw PDF bytes in this integration. The extension **rasterizes** each page (up to 12, JPEG data URLs, width capped) so the model receives the same visual information a human sees, without pasting `extractTextFromPdf` output into the prompt.

**PDF → local fallback:** `pdf.js` text items are joined per page; `parseResumeSections` applies heading/heuristics to fill the same JSON-shaped fields stored on `Resume`.

### Provider note

- **OpenAI**: PDF vision parsing is supported (page images + JSON response format).
- **DeepSeek** (`deepseek-chat`): Text-only in this project. The app does **not** send extracted resume text to DeepSeek for parsing (per product direction). With DeepSeek selected, parsing uses **local text rules** after `extractTextFromPdf` when AI vision is not used.

## (b) Function call chain

### Upload → persist (happy path, OpenAI + API key)

```text
ResumePage.handleFileChange
  └─ parseResume(file.name, file, { apiKey, aiProvider })
       ├─ extractTextFromPdf(file)                    [parallel: storage + fallback]
       ├─ renderPdfPagesToImageDataUrls(file, opts)   [parallel]
       └─ parseResumeWithAiProviderFromPdfPageImages(images, apiKey, "openai")
            └─ fetch(OpenAI /v1/chat/completions)
            └─ normalizeAiResumeJson(content)
       └─ buildResume(title, rawText, aiSections, "ai")
```

### Upload → local fallback (no key, DeepSeek, or AI error)

```text
ResumePage.handleFileChange
  └─ parseResume(...)
       ├─ extractTextFromPdf(file)
       └─ parseResumeSections(rawText)
       └─ buildResume(title, rawText, localSections, "local")
```

### Tailor (after navigation)

```text
App state: currentResume from chrome.storage.local
  └─ TailorPage (props: resume, onResumeChange)
       ├─ saveResume / updateResumeSection / …
       └─ enrichResumeSections (optional re-parse for legacy resumes)
```

### Data persistence

```text
App.handleResumesAdd / handleResumeChange
  └─ chrome.storage.local.set({ resumes: [...] })
```

## Key files

| File | Role |
|------|------|
| `src/app/pages/ResumePage.tsx` | File input, calls `parseResume` with `File`. |
| `src/application/parseResume.ts` | Orchestration, `CURRENT_RESUME_PARSER_VERSION`, `buildResume`, `isResumeParsed`. |
| `src/infrastructure/parser/pdfResumeParser.ts` | `extractTextFromPdf`, `renderPdfPagesToImageDataUrls`. |
| `src/infrastructure/ai/aiResumeParser.ts` | OpenAI multimodal request, `normalizeAiResumeJson`, `supportsResumePdfVisionParsing`. |
| `src/application/parseResumeSections.ts` | Local heuristic parser → `ParsedResumeSections`. |
| `src/domain/resume.ts` | `Resume` and nested types. |
| `src/app/pages/TailorPage.tsx` | Structured editing + debug JSON. |

## Privacy

- The **PDF file binary** is not uploaded to a custom backend; the browser sends page images and prompts directly to the user’s chosen AI API (OpenAI) from the extension context.
- **Local fallback** keeps text in memory and `chrome.storage.local` only, per `AGENTS.md`.

## Versioning

`Resume.parserVersion` uses `CURRENT_RESUME_PARSER_VERSION` in `parseResume.ts`. Bumping it marks resumes that should be re-parsed when `isResumeParsed` gates features.

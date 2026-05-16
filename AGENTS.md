# Agent Rules For AI Resume Chrome Extension

## Product Direction

Build a local-first Chrome extension for tailoring resumes to job descriptions.

The MVP target is a usable version within two days:

- Scan the current job description from the active browser tab.
- Let the user paste or import resume text.
- Let the user provide their own AI API key.
- Extract job key points and key requirements.
- Generate resume rewrite suggestions.
- Generate a cover letter.
- Let the user copy results.

Do not add login, backend services, cloud sync, payment, PDF export, DOCX export, or Chrome Web Store publishing unless the user explicitly asks.

## Privacy And Data Rules

- The product should work without user login.
- Use an anonymous local device ID only if needed for local identity or local history.
- Store user data locally by default using Chrome extension storage.
- Do not send resume data to any custom backend unless the user explicitly approves a backend design.
- The user provides their own AI API key.
- Be transparent in UI copy that the API key is stored locally if persistence is implemented.
- Never hardcode API keys, secrets, or private tokens.
- Avoid logging resume text, cover letters, API keys, or full job descriptions.

## Architecture

Use a local-first Chrome Extension architecture:

- Extension UI: React pages and reusable components.
- Content script: reads job page content from the active tab.
- Background script: coordinates Chrome extension messaging and privileged APIs.
- Application layer: use cases such as scan job, save resume, generate rewrite, and generate cover letter.
- Domain layer: core types such as Resume, JobDescription, Requirement, TailoringSuggestion, and CoverLetter.
- Infrastructure layer: Chrome storage, AI provider adapters, document parsing, and export utilities.

Keep UI separate from business logic. Components should not directly build AI prompts or call provider SDKs. Route those calls through use cases and service interfaces.

## Module Boundaries

Prefer small focused modules:

- `app/` for pages, components, and UI state.
- `extension/` for manifest-related scripts, content scripts, background scripts, and messaging.
- `domain/` for business types and pure logic.
- `application/` for use cases and workflow orchestration.
- `infrastructure/` for external APIs, Chrome APIs, local storage, parsers, and exporters.
- `shared/` for common utilities and shared types.

When adding a feature, change the smallest number of modules possible.

## Development Style

- Work incrementally. Do not generate the whole system in one step.
- Each implementation step should map to one small feature or one small page.
- Explain the purpose of each new file when adding it.
- Prefer readable code over clever abstractions.
- Use TypeScript for source code.
- Prefer React functional components.
- Prefer explicit domain types over loose `any`.
- Do not introduce a global state library unless local React state becomes painful.
- Do not introduce a backend framework unless the product direction changes.

## MVP UI Scope

The first usable version can be reduced to three core screens:

- Scan: scan current page and show extracted job content.
- Resume: paste resume text and generate AI suggestions.
- Results: show rewritten resume suggestions and cover letter with copy buttons.

Existing static HTML files are visual references. Reuse the flow and visual language, but migrate gradually into React components.

Reusable UI should be extracted only when repetition appears naturally, for example:

- Topbar
- StepProgress
- Card
- Button
- Chip
- ScoreBadge
- FooterAction

## AI Rules

- Support one provider first, preferably OpenAI, before adding more providers.
- Wrap provider-specific calls behind an AI provider interface.
- Keep prompts in dedicated prompt builder modules.
- AI suggestions must preserve truthfulness and avoid inventing experience.
- Prefer suggestion-based rewriting where the user can review before applying.
- Show errors clearly when the API key is missing, invalid, rate-limited, or the provider request fails.

## Chrome Extension Rules

- Use Manifest V3.
- Request minimal permissions.
- Prefer `activeTab`, `storage`, and `scripting` for the MVP.
- Do not request broad host permissions unless required and explained.
- Read the active page only after a user action such as clicking "Scan Job Page".
- Keep content scripts focused on page extraction, not business logic.

## Testing And Verification

After substantive code changes, run **`npm run verify`** from the project root. That runs ESLint on `src/` and **`tests/`**, **Vitest** over **`tests/**/*.test.ts`** (`tests/unit/`, `tests/integration/`, `tests/dom/`), TypeScript `tsc --noEmit`, and a production Vite build. Use **`npm run lint`** for a faster lint-only pass, or **`npm run test`** for tests only (see **`npm run test:watch`**).

For each completed feature, verify the narrow behavior that changed:

- UI renders without obvious errors.
- Chrome extension builds successfully (`npm run verify` or `npm run build`).
- Local storage reads and writes expected values.
- Scan flow can read text from the active tab.
- AI flow handles success and failure states.

Avoid broad refactors while fixing a narrow bug.

## Collaboration Rules

- Before coding, state the small feature being implemented.
- Do not batch unrelated features.
- If a design choice has trade-offs, explain the simplest option first.
- If the user asks to understand code, prioritize explanation over speed.
- Keep generated code easy for a beginner-to-intermediate developer to follow.

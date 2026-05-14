# Privacy Policy — Resume Tailor

**Effective date:** 15 May 2026

This Markdown file mirrors the HTML policy in [`privacy-policy.html`](privacy-policy.html). For the **Chrome Web Store**, host the HTML at a public **HTTPS** URL and paste that URL in the listing’s **Privacy practices** field.

---

## 1. Overview

**Resume Tailor** is a **local-first** Chrome extension. It does not require a user account, and this open-source project does not operate a separate application server that stores your résumé or cover letters on the author’s infrastructure.

## 2. Data the extension processes

- **API key and provider settings** — Stored locally in the browser (Chrome extension storage) when you choose to save them.
- **Résumé content** — Parsed from files you upload (e.g. PDF) and your edits; stored locally.
- **Job description content** — Text from the active tab when you run a scan, plus extracted fields (requirements, keywords, etc.); stored locally.
- **AI-generated content** — Suggestions and letters when you request them; stored locally as part of normal use.

## 3. Third-party AI providers

When you use AI features, the extension sends necessary content from your browser to the **third-party provider** you configure (e.g. OpenAI or DeepSeek), using **your** API key. That processing is governed by the **provider’s** privacy policy and terms.

## 4. Permissions

- **activeTab** — Access tab content when you take an explicit action (e.g. job scan).
- **storage** — Persist settings and your work locally.
- **scripting** — Inject or coordinate extension scripts where required (e.g. floating UI).
- **Host permissions** for declared AI API hosts — Network calls only to those endpoints for AI features.

## 5. Children

The extension is not intended for children under the age required in your jurisdiction.

## 6. Changes

Material updates will be reflected by changing the effective date and the hosted policy page.

## 7. Contact

Use the issue tracker or contact channel linked from the **README** of the GitHub repository where you obtained Resume Tailor. For your own published build, add a clear email or support link in that README.

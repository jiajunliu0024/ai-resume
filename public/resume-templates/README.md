# Bundled résumé PDF templates (static preview)

Place PDF files here so they are copied into the extension build and appear under **Preview resume → Static design template**.

Suggested filenames (match `src/infrastructure/pdf/bundledResumeTemplates.ts`):

| File in this folder | Suggested source |
|---------------------|------------------|
| `tammy-resume.pdf` | e.g. your “Tammy Resume.pdf” from Downloads (rename to remove spaces) |
| `jiajun-liu-resume-sd.pdf` | e.g. `Jiajun_Liu_Resume_SD_jiajun.pdf` |

After adding or changing files, run `npm run build` and reload the extension in `chrome://extensions`.

Static templates are **reference layouts only** — they are not filled with your Tailor data. Use **Tailored PDF from my data** to generate a PDF from your structured fields (still not pixel-identical to a hand-designed InDesign/LaTeX file).

/** Escape plain text for safe inclusion inside LaTeX arguments. */
export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/** Escape URL fragment for `\\href{...}{}` (hyperref). */
export function escapeHrefUrl(url: string): string {
  return url.replace(/\\/g, "/").replace(/#/g, "\\#").replace(/%/g, "\\%").replace(/\s/g, "%20");
}

// @vitest-environment jsdom
/**
 * DOM environment: relies on jsdom-backed `document` / `window` (see Vitest pragma above).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { extractPageText } from "../../src/extension/content/extractPageText";

describe("extractPageText", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "";
  });

  it("returns document title, window URL, and trimmed body innerText", () => {
    document.title = "Acme Backend Role";
    document.body.innerHTML =
      "<main><article><p>  First JD paragraph stays readable.  </p><p>Second line for scanning.</p></article></main>";

    const out = extractPageText();

    expect(out.title).toBe("Acme Backend Role");
    expect(out.url).toBe(window.location.href);
    expect(out.text).toContain("First JD paragraph stays readable.");
    expect(out.text).toContain("Second line for scanning.");
    expect(out.text).toBe(out.text.trim());
  });

  it("returns blank text when body has only empty structural nodes", () => {
    document.body.innerHTML = "<div></div>";
    expect(extractPageText().text).toBe("");
  });

  it("does not mutate the DOM beyond reading intrinsic properties", () => {
    document.body.innerHTML = "<span data-x='1'>Visible copy for scan.</span>";
    extractPageText();
    expect(document.body.querySelector("span[data-x='1']")?.textContent).toBe(
      "Visible copy for scan.",
    );
  });
});

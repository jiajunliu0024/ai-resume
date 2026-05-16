import { describe, expect, it } from "vitest";
import {
  dedupeAchievementList,
  finalizeExperienceAchievements,
  stripAchievementTrailingRoleLine,
} from "../../../src/shared/experienceAchievements";

/** Unit tests for experience bullet normalization used by local + AI parsers. */
describe("experienceAchievements", () => {
  describe("dedupeAchievementList", () => {
    it("drops bullets shorter than 8 characters after trim", () => {
      expect(dedupeAchievementList(["tiny", "  ok long enough line here  "])).toEqual(["ok long enough line here"]);
    });

    it("removes exact duplicates case-insensitively keeping first casing", () => {
      expect(
        dedupeAchievementList(["Shipped MVP on time.", "shipped mvP on time.", "Different achievement line here"]),
      ).toEqual(["Shipped MVP on time.", "Different achievement line here"]);
    });

    it("merges PDF-style duplicates differing only by terminal punctuation via soft-key dedupe", () => {
      expect(dedupeAchievementList(["Integrated GraphQL federation hub", "Integrated GraphQL federation hub."]))
        .toEqual(["Integrated GraphQL federation hub."]);
    });

    it("prefers the longer wording when soft keys only differ by terminal punctuation", () => {
      expect(
        dedupeAchievementList(["Quarterly KPI beats prior runway", "Quarterly KPI beats prior runway!!"]),
      ).toEqual(["Quarterly KPI beats prior runway!!"]);
    });
  });

  describe("stripAchievementTrailingRoleLine", () => {
    it("strips trailing title fragment accidentally concatenated onto a bullet tail", () => {
      expect(
        stripAchievementTrailingRoleLine(
          "Improved SLA by 22% Principal Engineer",
          "Principal Engineer",
          "Remote",
        ),
      ).toBe("Improved SLA by 22%");
    });

    it("returns trimmed line unchanged when suffix does not match role fragments", () => {
      expect(stripAchievementTrailingRoleLine("Plain achievement text here okay", "Other Title", "")).toBe(
        "Plain achievement text here okay",
      );
    });
  });

  describe("finalizeExperienceAchievements", () => {
    it("dedupes punctuation-only variants after stripping passes through unaffected lines", () => {
      expect(
        finalizeExperienceAchievements(
          [
            "Unique delivery milestone exceeding eight chars wide",
            "Unique delivery milestone exceeding eight chars wide.",
            "Separate trackable win exceeding eight chars here.",
          ],
          "",
          "",
        ),
      ).toEqual([
        "Unique delivery milestone exceeding eight chars wide.",
        "Separate trackable win exceeding eight chars here.",
      ]);
    });
  });
});

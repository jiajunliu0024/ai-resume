/**
 * Normalizes bullet lists under experience entries (local + AI parsers often repeat lines).
 */

/**
 * Soft key: ignores trailing `.` / `!` / `?` so PDF line-wrap duplicates like
 * "…Hub" vs "…Hub." collapse to one entry (common in local `parseResumeSections`).
 */
function achievementSoftDedupeKey(line: string): string {
  return line.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?]+$/u, "").trim();
}

export function dedupeAchievementList(items: string[]): string[] {
  const bySoftKey = new Map<string, string>();

  for (const raw of items) {
    const norm = raw.replace(/\s+/g, " ").trim();
    if (norm.length < 8) {
      continue;
    }

    const exactKey = norm.toLowerCase();
    if ([...bySoftKey.values()].some((kept) => kept.toLowerCase() === exactKey)) {
      continue;
    }

    const softKey = achievementSoftDedupeKey(norm);
    const previous = bySoftKey.get(softKey);

    if (!previous) {
      bySoftKey.set(softKey, norm);
      continue;
    }

    const pickLonger =
      norm.length > previous.length || (norm.endsWith(".") && !previous.endsWith("."));
    if (pickLonger) {
      bySoftKey.set(softKey, norm);
    }
  }

  return [...bySoftKey.values()];
}

export function stripAchievementTrailingRoleLine(
  line: string,
  title: string,
  location: string,
): string {
  let out = line.replace(/\s+/g, " ").trim();
  const fragments = [title, location, `${title} ${location}`]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 6);

  for (const fragment of fragments) {
    if (out.endsWith(fragment)) {
      out = out.slice(0, -fragment.length).trim().replace(/[\s.;]+$/g, "");
    }
  }

  return out;
}

export function finalizeExperienceAchievements(
  achievements: string[],
  title: string,
  location: string,
): string[] {
  const cleaned = achievements
    .map((line) => stripAchievementTrailingRoleLine(line, title, location))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 8);

  return dedupeAchievementList(cleaned);
}

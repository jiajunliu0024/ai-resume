/**
 * Normalizes bullet lists under experience entries (local + AI parsers often repeat lines).
 */

export function dedupeAchievementList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of items) {
    const norm = raw.replace(/\s+/g, " ").trim();
    if (norm.length < 8) {
      continue;
    }

    const key = norm.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(norm);
  }

  return out;
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

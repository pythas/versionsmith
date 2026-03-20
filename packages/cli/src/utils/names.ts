import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ADJECTIVES = [
  "ancient", "brave", "calm", "dark", "eager",
  "fair", "gentle", "happy", "idle", "jolly",
  "keen", "lively", "merry", "noble", "odd",
  "plain", "quiet", "rapid", "swift", "tidy",
  "ultra", "vivid", "warm", "exact", "young",
  "amber", "blunt", "crisp", "dull", "early",
  "faint", "grand", "harsh", "icy", "jazzy",
  "kind", "large", "mild", "neat", "open",
  "pale", "quick", "rare", "slim", "tall",
  "urban", "vast", "wild", "xeric", "zesty",
];

const NOUNS = [
  "anchor", "bridge", "castle", "delta", "ember",
  "fjord", "glacier", "harbor", "island", "jungle",
  "knoll", "lagoon", "meadow", "nexus", "ocean",
  "peak", "quarry", "river", "summit", "tundra",
  "uplift", "valley", "wetland", "xenon", "zenith",
  "arrow", "basin", "canyon", "dune", "estuary",
  "forest", "gorge", "heath", "inlet", "jetty",
  "kelp", "ledge", "marsh", "nova", "orbit",
  "pine", "quartz", "ridge", "shore", "trail",
  "umbra", "vortex", "wave", "xylem", "yard",
];

/**
 * Generates a human-readable random name like "brave-dolphins".
 * Checks the given directory for collisions and appends a counter if needed.
 */
export function generateName(dir: string): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const base = `${adjective}-${noun}`;

  if (!existsSync(dir)) {
    return base;
  }

  const existing = new Set(
    readdirSync(dir).map((f) => f.replace(/\.md$/, ""))
  );

  if (!existing.has(base)) {
    return base;
  }

  let counter = 2;
  while (existing.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Returns the full path for a new changeset file.
 */
export function changesetPath(dir: string, name: string): string {
  return join(dir, `${name}.md`);
}

import type { ChangeType } from "./changelog.ts";
import { CHANGE_TYPES } from "./changelog.ts";

const CHANGE_TYPES_LOWER = new Map<string, ChangeType>(
  CHANGE_TYPES.map((t) => [t.toLowerCase(), t])
);

/**
 * Returns true if the given string is a recognized change type (case-insensitive).
 */
export function isChangeType(s: string): boolean {
  return CHANGE_TYPES_LOWER.has(s.toLowerCase());
}

/**
 * Parse CLI args as alternating <type> <description> pairs.
 *
 *   ["added", "Dark mode", "fixed", "Login bug"]
 *   → { Added: ["Dark mode"], Fixed: ["Login bug"] }
 *
 * Throws on invalid input with a descriptive message.
 */
export function parseInlineEntries(
  args: string[]
): Partial<Record<ChangeType, string[]>> {
  if (args.length === 0) {
    throw new Error("No entries provided.");
  }

  const entries: Partial<Record<ChangeType, string[]>> = {};

  for (let i = 0; i < args.length; i += 2) {
    const rawType = args[i];
    const description = args[i + 1];

    const type = CHANGE_TYPES_LOWER.get(rawType.toLowerCase());
    if (!type) {
      throw new Error(
        `'${rawType}' is not a valid change type. Valid types: ${CHANGE_TYPES.map((t) => t.toLowerCase()).join(", ")}`
      );
    }

    if (!description) {
      throw new Error(`Missing description after '${rawType}'.`);
    }

    if (!entries[type]) entries[type] = [];
    entries[type]!.push(description.trim());
  }

  return entries;
}

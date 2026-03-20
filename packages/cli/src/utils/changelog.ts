/**
 * Utilities for parsing and generating CHANGELOG.md files
 * following the Keep a Changelog 1.1.0 format.
 */

export type ChangeType =
  | "Added"
  | "Changed"
  | "Deprecated"
  | "Removed"
  | "Fixed"
  | "Security";

export const CHANGE_TYPES: ChangeType[] = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
];

/** A single changeset parsed from a .versionsmith/*.md file */
export interface Changeset {
  /** Map from change type to list of bullet entries (without the leading "- ") */
  entries: Partial<Record<ChangeType, string[]>>;
}

/** A parsed release section from CHANGELOG.md */
export interface Release {
  /** e.g. "1.2.0" or "Unreleased" */
  version: string;
  /** ISO date string e.g. "2026-03-20", undefined for Unreleased */
  date?: string;
  entries: Partial<Record<ChangeType, string[]>>;
  /** Raw trailing content (links, etc.) after all sections */
  rawTrailing?: string;
}

/**
 * Parse a changeset markdown file into structured entries.
 *
 * Expected format:
 * ```md
 * ### Added
 *
 * - Something new.
 *
 * ### Fixed
 *
 * - A bug.
 * ```
 */
export function parseChangeset(content: string): Changeset {
  const entries: Partial<Record<ChangeType, string[]>> = {};
  let currentType: ChangeType | null = null;

  for (const line of content.split("\n")) {
    const typeMatch = line.match(/^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)\s*$/);
    if (typeMatch) {
      currentType = typeMatch[1] as ChangeType;
      if (!entries[currentType]) entries[currentType] = [];
      continue;
    }
    if (currentType && line.startsWith("- ")) {
      entries[currentType]!.push(line.slice(2).trim());
    }
  }

  return { entries };
}

/**
 * Render a changeset (or merged entries) as a markdown string with ### headers.
 */
export function renderEntries(
  entries: Partial<Record<ChangeType, string[]>>
): string {
  const parts: string[] = [];
  for (const type of CHANGE_TYPES) {
    const items = entries[type];
    if (!items || items.length === 0) continue;
    parts.push(`### ${type}\n`);
    for (const item of items) {
      parts.push(`- ${item}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

/**
 * Merge multiple changesets into one set of entries.
 */
export function mergeChangesets(
  changesets: Changeset[]
): Partial<Record<ChangeType, string[]>> {
  const merged: Partial<Record<ChangeType, string[]>> = {};
  for (const cs of changesets) {
    for (const type of CHANGE_TYPES) {
      const items = cs.entries[type];
      if (!items || items.length === 0) continue;
      if (!merged[type]) merged[type] = [];
      merged[type]!.push(...items);
    }
  }
  return merged;
}

/**
 * Parse the full CHANGELOG.md content into structured releases.
 * Returns the header (everything before the first ## heading) and releases.
 */
export function parseChangelog(content: string): {
  header: string;
  releases: Release[];
} {
  const lines = content.split("\n");
  let headerLines: string[] = [];
  let releases: Release[] = [];
  let currentRelease: Release | null = null;
  let currentType: ChangeType | null = null;
  let foundFirstRelease = false;

  for (const line of lines) {
    // Match a release heading: ## [version] - date  OR  ## [Unreleased]
    const releaseMatch = line.match(
      /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/
    );
    if (releaseMatch) {
      if (currentRelease) {
        releases.push(currentRelease);
      }
      foundFirstRelease = true;
      currentType = null;
      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2],
        entries: {},
      };
      continue;
    }

    if (!foundFirstRelease) {
      headerLines.push(line);
      continue;
    }

    if (currentRelease) {
      const typeMatch = line.match(
        /^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)\s*$/
      );
      if (typeMatch) {
        currentType = typeMatch[1] as ChangeType;
        if (!currentRelease.entries[currentType]) {
          currentRelease.entries[currentType] = [];
        }
        continue;
      }
      if (currentType && line.startsWith("- ")) {
        currentRelease.entries[currentType]!.push(line.slice(2).trim());
        continue;
      }
      // Multi-line bullet continuation (lines starting with spaces under a bullet)
      if (currentType && line.match(/^\s{2,}/) && currentRelease.entries[currentType]!.length > 0) {
        const arr = currentRelease.entries[currentType]!;
        arr[arr.length - 1] += "\n" + line;
        continue;
      }
    }
  }

  if (currentRelease) {
    releases.push(currentRelease);
  }

  // Trim trailing blank lines from header
  while (headerLines.length > 0 && headerLines[headerLines.length - 1].trim() === "") {
    headerLines.pop();
  }

  return { header: headerLines.join("\n"), releases };
}

/**
 * Render a full CHANGELOG.md string from header + releases.
 */
export function renderChangelog(header: string, releases: Release[]): string {
  const parts: string[] = [header, ""];

  for (const release of releases) {
    const heading =
      release.version === "Unreleased"
        ? "## [Unreleased]"
        : `## [${release.version}] - ${release.date}`;
    parts.push(heading);
    parts.push("");

    const body = renderEntries(release.entries);
    if (body) {
      parts.push(body);
    }
  }

  // Ensure single trailing newline
  const result = parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  return result + "\n";
}

/**
 * Insert or update the [Unreleased] section with new entries.
 * If [Unreleased] already exists, entries are prepended to its existing ones.
 */
export function insertUnreleased(
  parsed: { header: string; releases: Release[] },
  newEntries: Partial<Record<ChangeType, string[]>>
): { header: string; releases: Release[] } {
  const releases = [...parsed.releases];
  const unreleasedIdx = releases.findIndex((r) => r.version === "Unreleased");

  if (unreleasedIdx === -1) {
    // Add a fresh Unreleased section at the top
    releases.unshift({ version: "Unreleased", entries: newEntries });
  } else {
    const existing = releases[unreleasedIdx];
    const merged: Partial<Record<ChangeType, string[]>> = {};
    for (const type of CHANGE_TYPES) {
      const existingItems = existing.entries[type] ?? [];
      const newItems = newEntries[type] ?? [];
      if (existingItems.length > 0 || newItems.length > 0) {
        merged[type] = [...existingItems, ...newItems];
      }
    }
    releases[unreleasedIdx] = { ...existing, entries: merged };
  }

  return { ...parsed, releases };
}

/**
 * Convert the [Unreleased] section into a versioned release (or create a new one).
 * Removes the [Unreleased] section's entries and inserts a dated version at top.
 */
export function promoteToRelease(
  parsed: { header: string; releases: Release[] },
  version: string,
  date: string,
  newEntries: Partial<Record<ChangeType, string[]>>
): { header: string; releases: Release[] } {
  const releases = [...parsed.releases];
  const unreleasedIdx = releases.findIndex((r) => r.version === "Unreleased");

  // Merge existing Unreleased entries with the new ones
  const existingUnreleased =
    unreleasedIdx !== -1 ? releases[unreleasedIdx].entries : {};
  const mergedEntries: Partial<Record<ChangeType, string[]>> = {};
  for (const type of CHANGE_TYPES) {
    const a = existingUnreleased[type] ?? [];
    const b = newEntries[type] ?? [];
    if (a.length > 0 || b.length > 0) {
      mergedEntries[type] = [...a, ...b];
    }
  }

  const newRelease: Release = { version, date, entries: mergedEntries };

  if (unreleasedIdx !== -1) {
    // Replace Unreleased with an empty one, and insert versioned after header
    releases.splice(unreleasedIdx, 1);
  }

  // Insert new versioned release at position 0 (or after a fresh empty Unreleased)
  releases.unshift(newRelease);
  // Keep an empty [Unreleased] at the very top
  releases.unshift({ version: "Unreleased", entries: {} });

  return { ...parsed, releases };
}

/**
 * Today's date in ISO 8601 format.
 */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

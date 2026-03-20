import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { readConfig, isInitialized, getVersionsmithDir } from "../utils/config.ts";
import {
  parseChangeset,
  mergeChangesets,
  parseChangelog,
  renderChangelog,
  insertUnreleased,
  promoteToRelease,
  today,
} from "../utils/changelog.ts";
import type { Changeset } from "../utils/changelog.ts";

export interface ReleaseOptions {
  /** If provided, creates a versioned release. Otherwise merges into [Unreleased]. */
  version?: string;
  /** Override the date (defaults to today). Useful for testing. */
  date?: string;
  cwd?: string;
}

export async function release(options: ReleaseOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  if (!isInitialized(cwd)) {
    console.error(
      "versionsmith is not initialized. Run `npx @versionsmith/cli init` first."
    );
    process.exit(1);
  }

  const config = readConfig(cwd);
  const dir = getVersionsmithDir(cwd);
  const changelogPath = join(cwd, config.changelog);

  // Collect changeset files (ignore config.json, .gitkeep)
  const files = existsSync(dir)
    ? readdirSync(dir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      )
    : [];

  // With no --version, there's nothing to do without changeset files.
  // With --version, we can still promote whatever is already in [Unreleased].
  if (files.length === 0 && !options.version) {
    console.log("No changelog entries found in .versionsmith/");
    console.log("Run `npx @versionsmith/cli` to create one.");
    return;
  }

  // Parse all changesets
  const changesets: Changeset[] = files.map((f) => {
    const content = readFileSync(join(dir, f), "utf-8");
    return parseChangeset(content);
  });

  const merged = mergeChangesets(changesets);

  // Parse existing changelog (or start fresh)
  let parsed = { header: config.header, releases: [] as ReturnType<typeof parseChangelog>["releases"] };
  if (existsSync(changelogPath)) {
    const existing = readFileSync(changelogPath, "utf-8");
    parsed = parseChangelog(existing);
    // If the parsed header is empty (new file), use config header
    if (!parsed.header.trim()) {
      parsed = { ...parsed, header: config.header };
    }
  }

  // Apply changes
  const dateStr = options.date ?? today();
  let updated: typeof parsed;

  if (options.version) {
    updated = promoteToRelease(parsed, options.version, dateStr, merged);
    console.log(`\nReleasing version ${options.version} (${dateStr})\n`);
  } else {
    updated = insertUnreleased(parsed, merged);
    console.log(`\nMerging entries into [Unreleased]\n`);
  }

  // Write updated changelog
  const rendered = renderChangelog(updated.header, updated.releases);
  writeFileSync(changelogPath, rendered, "utf-8");

  // Remove consumed changeset files
  for (const f of files) {
    unlinkSync(join(dir, f));
  }

  // Summary
  console.log(`Updated ${config.changelog}`);
  if (files.length > 0) {
    console.log(`Removed ${files.length} changeset file(s):\n`);
    for (const f of files) {
      console.log(`  - .versionsmith/${f}`);
    }
  }

  console.log("\nDone! Review your changelog and commit the changes.");
}

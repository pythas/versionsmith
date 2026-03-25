import { writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { checkbox, input, confirm, select } from "@inquirer/prompts";
import {
  isInitialized,
  getVersionsmithDir,
} from "../utils/config.ts";
import type { ChangeType } from "../utils/changelog.ts";
import {
  CHANGE_TYPES,
  renderEntries,
  parseChangeset,
  mergeChangesets,
} from "../utils/changelog.ts";
import { generateName, changesetPath } from "../utils/names.ts";

/**
 * Non-interactive add: write entries directly from CLI args.
 * Appends to an existing changeset file when exactly one exists.
 */
export async function addInline(
  entries: Partial<Record<ChangeType, string[]>>,
  cwd: string = process.cwd()
): Promise<void> {
  if (!isInitialized(cwd)) {
    console.error(
      "versionsmith is not initialized. Run `npx @versionsmith/cli init` first."
    );
    process.exit(1);
  }

  const dir = getVersionsmithDir(cwd);

  const existingFiles = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    : [];

  let targetFile: string | null = null;
  let finalEntries = entries;

  if (existingFiles.length === 1) {
    targetFile = existingFiles[0];
    const existing = parseChangeset(readFileSync(join(dir, targetFile), "utf-8")).entries;
    finalEntries = mergeChangesets([{ entries: existing }, { entries }]);
  }

  const content = renderEntries(finalEntries);

  console.log("\n--- Preview ---");
  console.log(content);
  console.log("---------------\n");

  if (targetFile) {
    const filePath = join(dir, targetFile);
    writeFileSync(filePath, content, "utf-8");
    console.log(`Updated: .versionsmith/${targetFile}`);
  } else {
    const name = generateName(dir);
    const filePath = changesetPath(dir, name);
    writeFileSync(filePath, content, "utf-8");
    console.log(`Saved: .versionsmith/${name}.md`);
  }

  console.log(
    "\nCommit this file alongside your changes. When ready to release, run:"
  );
  console.log("  npx @versionsmith/cli release");
}

/**
 * Interactive add: prompt the user for change types and descriptions.
 */
export async function add(cwd: string = process.cwd()): Promise<void> {
  if (!isInitialized(cwd)) {
    console.error(
      "versionsmith is not initialized. Run `npx @versionsmith/cli init` first."
    );
    process.exit(1);
  }

  const dir = getVersionsmithDir(cwd);

  // Check for existing changeset files to allow appending
  const existingFiles = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    : [];

  let targetFile: string | null = null;
  let existingEntries: Partial<Record<ChangeType, string[]>> = {};

  if (existingFiles.length === 1) {
    // Auto-append to the single existing file
    targetFile = existingFiles[0];
    const content = readFileSync(join(dir, targetFile), "utf-8");
    existingEntries = parseChangeset(content).entries;
    console.log(`\nAppending to existing entry: .versionsmith/${targetFile}\n`);
  } else if (existingFiles.length > 1) {
    // Let the user pick which file to append to, or create a new one
    const CREATE_NEW = "__create_new__";
    const choice = await select<string>({
      message: "Existing changelog entries found. Append to one or create new?",
      choices: [
        ...existingFiles.map((f) => ({ name: f, value: f })),
        { name: "Create new entry", value: CREATE_NEW },
      ],
    });

    if (choice !== CREATE_NEW) {
      targetFile = choice;
      const content = readFileSync(join(dir, targetFile), "utf-8");
      existingEntries = parseChangeset(content).entries;
      console.log(`\nAppending to: .versionsmith/${targetFile}\n`);
    } else {
      console.log("\nCreate a new changelog entry\n");
    }
  } else {
    console.log("\nCreate a new changelog entry\n");
  }

  // Step 1: pick change types
  const selectedTypes = await checkbox<ChangeType>({
    message: "Select the type(s) of change (space to select, enter to confirm):",
    choices: CHANGE_TYPES.map((t) => ({
      name: t,
      value: t,
      description: typeDescription(t),
    })),
    validate: (v) =>
      v.length > 0 ? true : "Select at least one change type.",
  });

  // Step 2: for each type, collect entries
  const entries: Partial<Record<ChangeType, string[]>> = {};

  for (const type of selectedTypes) {
    console.log(`\n  ${type} — ${typeDescription(type)}`);
    const items: string[] = [];
    let addAnother = true;

    while (addAnother) {
      const description = await input({
        message: `  Describe the ${type.toLowerCase()} change:`,
        validate: (v) =>
          v.trim().length > 0 ? true : "Description cannot be empty.",
      });
      items.push(description.trim());

      addAnother = await confirm({
        message: `  Add another ${type.toLowerCase()} entry?`,
        default: false,
      });
    }

    entries[type] = items;
  }

  // Step 3: merge with existing entries if appending
  const finalEntries = targetFile
    ? mergeChangesets([{ entries: existingEntries }, { entries }])
    : entries;

  // Step 4: preview
  console.log("\n--- Preview ---");
  console.log(renderEntries(finalEntries));
  console.log("---------------\n");

  const confirmed = await confirm({
    message: "Save this changelog entry?",
    default: true,
  });

  if (!confirmed) {
    console.log("Aborted. No file written.");
    return;
  }

  // Step 5: write file
  const content = renderEntries(finalEntries);

  if (targetFile) {
    const filePath = join(dir, targetFile);
    writeFileSync(filePath, content, "utf-8");
    console.log(`\nUpdated: .versionsmith/${targetFile}`);
  } else {
    const name = generateName(dir);
    const filePath = changesetPath(dir, name);
    writeFileSync(filePath, content, "utf-8");
    console.log(`\nSaved: .versionsmith/${name}.md`);
  }

  console.log(
    "\nCommit this file alongside your changes. When ready to release, run:"
  );
  console.log("  npx @versionsmith/cli release");
}

function typeDescription(type: ChangeType): string {
  switch (type) {
    case "Added":
      return "New features";
    case "Changed":
      return "Changes in existing functionality";
    case "Deprecated":
      return "Soon-to-be removed features";
    case "Removed":
      return "Now removed features";
    case "Fixed":
      return "Bug fixes";
    case "Security":
      return "Vulnerability fixes";
  }
}

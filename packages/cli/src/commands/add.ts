import { writeFileSync } from "node:fs";
import { checkbox, input, confirm } from "@inquirer/prompts";
import {
  readConfig,
  isInitialized,
  getVersionsmithDir,
} from "../utils/config.ts";
import { CHANGE_TYPES, ChangeType, renderEntries } from "../utils/changelog.ts";
import { generateName, changesetPath } from "../utils/names.ts";

export async function add(cwd: string = process.cwd()): Promise<void> {
  if (!isInitialized(cwd)) {
    console.error(
      "versionsmith is not initialized. Run `npx @versionsmith/cli init` first."
    );
    process.exit(1);
  }

  const dir = getVersionsmithDir(cwd);

  console.log("\nCreate a new changelog entry\n");

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

  // Step 3: preview
  console.log("\n--- Preview ---");
  console.log(renderEntries(entries));
  console.log("---------------\n");

  const confirmed = await confirm({
    message: "Save this changelog entry?",
    default: true,
  });

  if (!confirmed) {
    console.log("Aborted. No file written.");
    return;
  }

  // Step 4: write file
  const name = generateName(dir);
  const filePath = changesetPath(dir, name);
  const content = renderEntries(entries);
  writeFileSync(filePath, content, "utf-8");

  console.log(`\nSaved: .versionsmith/${name}.md`);
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

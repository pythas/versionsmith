import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { input, confirm } from "@inquirer/prompts";
import {
  DEFAULT_CONFIG,
  getVersionsmithDir,
  getConfigPath,
  writeConfig,
  isInitialized,
} from "../utils/config.ts";

export async function init(cwd: string = process.cwd()): Promise<void> {
  const dir = getVersionsmithDir(cwd);
  const configPath = getConfigPath(cwd);

  if (isInitialized(cwd)) {
    console.log(
      `versionsmith is already initialized (found ${configPath.replace(cwd + "/", "")})`
    );
    const proceed = await confirm({
      message: "Re-initialize and overwrite config?",
      default: false,
    });
    if (!proceed) {
      console.log("Aborted.");
      return;
    }
  }

  console.log("\nWelcome to versionsmith!\n");
  console.log(
    "This tool helps you manage changelogs following the Keep a Changelog format."
  );
  console.log("https://keepachangelog.com/en/1.1.0/\n");

  // Changelog file location
  const changelogFile = await input({
    message: "Changelog file path:",
    default: DEFAULT_CONFIG.changelog,
    validate: (v) => (v.trim().length > 0 ? true : "Cannot be empty"),
  });

  // Changelog header
  console.log(
    "\nCustomize your changelog header (the text before any release sections)."
  );
  console.log(`Default:\n${DEFAULT_CONFIG.header}\n`);

  const useDefault = await confirm({
    message: "Use the default header?",
    default: true,
  });

  let header = DEFAULT_CONFIG.header;
  if (!useDefault) {
    header = await input({
      message: "Enter your changelog header (use \\n for newlines):",
      default: DEFAULT_CONFIG.header.replace(/\n/g, "\\n"),
      validate: (v) => (v.trim().length > 0 ? true : "Cannot be empty"),
    });
    header = header.replace(/\\n/g, "\n");
  }

  const config = {
    changelog: changelogFile.trim(),
    header,
  };

  // Create .versionsmith directory
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write config
  writeConfig(config, cwd);

  // Write .gitkeep so the directory is tracked in git
  const gitkeepPath = join(dir, ".gitkeep");
  if (!existsSync(gitkeepPath)) {
    writeFileSync(gitkeepPath, "", "utf-8");
  }

  // Create CHANGELOG.md if it doesn't exist
  const changelogPath = join(cwd, config.changelog);
  if (!existsSync(changelogPath)) {
    const initialContent =
      config.header + "\n\n## [Unreleased]\n";
    writeFileSync(changelogPath, initialContent, "utf-8");
    console.log(`\nCreated ${config.changelog}`);
  } else {
    console.log(`\n${config.changelog} already exists, skipping creation.`);
  }

  console.log(`Created .versionsmith/config.json`);
  console.log(`\nversionsmith initialized successfully!\n`);
  console.log("Next steps:");
  console.log("  npx @versionsmith/cli          - Create a new changelog entry");
  console.log(
    "  npx @versionsmith/cli release  - Merge entries into your changelog"
  );
  console.log(
    "  npx @versionsmith/cli release --version 1.0.0  - Release a specific version"
  );
}

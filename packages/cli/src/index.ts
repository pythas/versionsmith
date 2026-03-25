import { init } from "./commands/init.ts";
import { add, addInline } from "./commands/add.ts";
import { release } from "./commands/release.ts";
import type { ChangeType } from "./utils/changelog.ts";
import { isChangeType, parseInlineEntries } from "./utils/args.ts";

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

const args = process.argv.slice(2);
const command = args[0];

function parseVersion(args: string[]): string | undefined {
  const idx = args.indexOf("--version");
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  // Also support --version=1.2.3
  const flag = args.find((a) => a.startsWith("--version="));
  if (flag) {
    return flag.split("=")[1];
  }
  return undefined;
}

function showHelp() {
  console.log(`
versionsmith v${VERSION} — conflict-free changelog management

USAGE
  npx @versionsmith/cli [command] [options]

COMMANDS
  (no command)         Create a new changelog entry interactively
  new                  Alias for the default interactive command
  <type> <desc> [...]  Create an entry directly from the command line
  init                 Initialize versionsmith in the current directory
  release              Merge changeset entries into CHANGELOG.md

CHANGE TYPES
  added, changed, deprecated, removed, fixed, security

OPTIONS
  --version <version>  (release only) Create a versioned release entry
  --help, -h           Show this help message

EXAMPLES
  npx @versionsmith/cli init
  npx @versionsmith/cli
  npx @versionsmith/cli new
  npx @versionsmith/cli added "Dark mode support"
  npx @versionsmith/cli fixed "Login bug" added "New feature"
  npx @versionsmith/cli release
  npx @versionsmith/cli release --version 1.2.0
`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Check if first arg is a change type → inline add
  if (command && isChangeType(command)) {
    let entries: Partial<Record<ChangeType, string[]>>;
    try {
      entries = parseInlineEntries(args);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
    await addInline(entries);
    return;
  }

  switch (command) {
    case "init":
      await init();
      break;

    case "release": {
      const version = parseVersion(args.slice(1));
      await release({ version });
      break;
    }

    case "new":
    case undefined:
      await add();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  // Handle graceful Ctrl+C from inquirer
  if (
    err instanceof Error &&
    (err.message.includes("force closed") ||
      err.name === "ExitPromptError")
  ) {
    console.log("\nAborted.");
    process.exit(0);
  }
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

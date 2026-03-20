import { init } from "./commands/init.ts";
import { add } from "./commands/add.ts";
import { release } from "./commands/release.ts";

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
versionsmith — conflict-free changelog management

USAGE
  npx @versionsmith/cli [command] [options]

COMMANDS
  (no command)         Create a new changelog entry interactively
  add                  Alias for the default command
  init                 Initialize versionsmith in the current directory
  release              Merge changeset entries into CHANGELOG.md

OPTIONS
  --version <version>  (release only) Create a versioned release entry
  --help, -h           Show this help message

EXAMPLES
  npx @versionsmith/cli init
  npx @versionsmith/cli
  npx @versionsmith/cli add
  npx @versionsmith/cli release
  npx @versionsmith/cli release --version 1.2.0
`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
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

    case "add":
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

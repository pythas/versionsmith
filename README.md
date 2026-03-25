# versionsmith

Conflict-free changelog management following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

Each contributor writes their changes to an individual file in `.versionsmith/`. These files merge cleanly across branches. When you are ready to release, versionsmith merges them all into `CHANGELOG.md` and removes the individual files.

versionsmith is version scheme agnostic. You supply the version string at release time — whether that is semver, calendar versioning, or anything else is entirely up to you.

## Requirements

Node.js 22 or later.

## Install

No install required. Run directly with npx:

```bash
npx @versionsmith/cli init
```

Or install globally:

```bash
npm install -g @versionsmith/cli
```

## Setup

Initialize versionsmith in your project root:

```bash
npx @versionsmith/cli init
```

This creates:
- `.versionsmith/` — directory where individual change files are stored
- `.versionsmith/config.json` — configuration (changelog path, header text)
- `CHANGELOG.md` — your changelog file (if it does not already exist)

Commit `.versionsmith/config.json` and `.versionsmith/.gitkeep` to your repository.

## Usage

### Create a changelog entry

From the command line (non-interactive):

```bash
npx @versionsmith/cli added "Dark mode support"
npx @versionsmith/cli fixed "Login redirect bug"
npx @versionsmith/cli added "Dark mode" fixed "Login bug" changed "Updated API format"
```

Change types: `added`, `changed`, `deprecated`, `removed`, `fixed`, `security` (case-insensitive).

Or interactively:

```bash
npx @versionsmith/cli
npx @versionsmith/cli new
```

You will be prompted to select the type of change and enter a description. A file like `.versionsmith/brave-delta.md` is written. Commit this file alongside your code changes.

### Release

Merge all pending entries into `CHANGELOG.md` under an `[Unreleased]` section:

```bash
npx @versionsmith/cli release
```

Merge and tag with a specific version:

```bash
npx @versionsmith/cli release --version 1.2.0
```

This moves all pending entries (including anything already in `[Unreleased]`) into a dated `[1.2.0] - YYYY-MM-DD` section, leaves a fresh empty `[Unreleased]` at the top, and removes the individual changeset files.

## Workflow

```
# Developer on a feature branch
npx @versionsmith/cli added "Dark mode"
git add .versionsmith/brave-delta.md
git commit -m "Add dark mode"

# Another developer on a different branch
npx @versionsmith/cli fixed "Login redirect"
git add .versionsmith/calm-ridge.md
git commit -m "Fix login redirect"

# Both branches merge cleanly — no CHANGELOG.md conflicts

# When ready to release
npx @versionsmith/cli release --version 1.0.0
git add CHANGELOG.md .versionsmith/
git commit -m "Release 1.0.0"
git tag v1.0.0
```

## Configuration

`.versionsmith/config.json`:

```json
{
  "changelog": "CHANGELOG.md",
  "header": "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)."
}
```

## Commands

| Command | Description |
|---------|-------------|
| `versionsmith init` | Initialize versionsmith in the current directory |
| `versionsmith` | Create a new changelog entry interactively |
| `versionsmith new` | Alias for the default interactive command |
| `versionsmith added "desc"` | Create an entry directly from the command line |
| `versionsmith fixed "A" added "B"` | Create multiple entries at once |
| `versionsmith release` | Merge entries into `[Unreleased]` in `CHANGELOG.md` |
| `versionsmith release --version 1.0.0` | Merge entries into a dated versioned release |

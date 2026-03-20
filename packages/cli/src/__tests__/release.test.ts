import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { release } from "../commands/release.ts";
import { VERSIONSMITH_DIR } from "../utils/config.ts";

const TMP_BASE = join(tmpdir(), "versionsmith-release-test");

function makeProject(name: string) {
  const dir = join(TMP_BASE, name);
  const vsDir = join(dir, VERSIONSMITH_DIR);
  mkdirSync(vsDir, { recursive: true });

  // Write config
  writeFileSync(
    join(vsDir, "config.json"),
    JSON.stringify({
      changelog: "CHANGELOG.md",
      header:
        "# Changelog\n\nAll notable changes to this project will be documented in this file.",
    }),
    "utf-8"
  );

  return { dir, vsDir };
}

describe("release command", () => {
  before(() => mkdirSync(TMP_BASE, { recursive: true }));
  after(() => rmSync(TMP_BASE, { recursive: true, force: true }));

  it("reports no entries when .versionsmith is empty", async () => {
    const { dir } = makeProject("empty");
    // Capture console output by checking no error is thrown
    await release({ cwd: dir });
    // No changelog should be created
    assert.ok(!existsSync(join(dir, "CHANGELOG.md")));
  });

  it("creates CHANGELOG.md from changesets when it does not exist", async () => {
    const { dir, vsDir } = makeProject("create-new");

    writeFileSync(
      join(vsDir, "brave-ocean.md"),
      "### Added\n\n- New feature.\n",
      "utf-8"
    );

    await release({ cwd: dir, date: "2026-03-20" });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    assert.ok(content.includes("## [Unreleased]"));
    assert.ok(content.includes("### Added"));
    assert.ok(content.includes("- New feature."));
    // Changeset file should be removed
    assert.ok(!existsSync(join(vsDir, "brave-ocean.md")));
  });

  it("creates a versioned release with --version", async () => {
    const { dir, vsDir } = makeProject("versioned");

    writeFileSync(
      join(vsDir, "swift-river.md"),
      "### Fixed\n\n- A bug.\n",
      "utf-8"
    );

    await release({ cwd: dir, version: "1.0.0", date: "2026-03-20" });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    assert.ok(content.includes("## [1.0.0] - 2026-03-20"));
    assert.ok(content.includes("### Fixed"));
    assert.ok(content.includes("- A bug."));
    assert.ok(!existsSync(join(vsDir, "swift-river.md")));
  });

  it("merges multiple changeset files", async () => {
    const { dir, vsDir } = makeProject("multi");

    writeFileSync(
      join(vsDir, "file-a.md"),
      "### Added\n\n- Feature A.\n",
      "utf-8"
    );
    writeFileSync(
      join(vsDir, "file-b.md"),
      "### Added\n\n- Feature B.\n### Fixed\n\n- Fix C.\n",
      "utf-8"
    );

    await release({ cwd: dir, version: "2.0.0", date: "2026-03-20" });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    assert.ok(content.includes("- Feature A."));
    assert.ok(content.includes("- Feature B."));
    assert.ok(content.includes("- Fix C."));
  });

  it("appends to existing CHANGELOG.md with [Unreleased] mode", async () => {
    const { dir, vsDir } = makeProject("append");

    const existing = `# Changelog

All notable changes.

## [Unreleased]

### Added

- Existing feature.

## [1.0.0] - 2026-01-01

### Fixed

- Old fix.
`;
    writeFileSync(join(dir, "CHANGELOG.md"), existing, "utf-8");
    writeFileSync(
      join(vsDir, "new-entry.md"),
      "### Added\n\n- Another feature.\n",
      "utf-8"
    );

    await release({ cwd: dir });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    assert.ok(content.includes("- Existing feature."));
    assert.ok(content.includes("- Another feature."));
    assert.ok(content.includes("## [1.0.0] - 2026-01-01"));
  });

  it("creates empty [Unreleased] section after versioned release", async () => {
    const { dir, vsDir } = makeProject("empty-unreleased");

    writeFileSync(
      join(vsDir, "entry.md"),
      "### Security\n\n- CVE patch.\n",
      "utf-8"
    );

    await release({ cwd: dir, version: "1.2.3", date: "2026-03-20" });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    // Should have empty Unreleased at top
    assert.ok(content.includes("## [Unreleased]"));
    assert.ok(content.includes("## [1.2.3] - 2026-03-20"));
    // Unreleased should come before the version
    const unreleasedPos = content.indexOf("## [Unreleased]");
    const versionPos = content.indexOf("## [1.2.3]");
    assert.ok(unreleasedPos < versionPos);
  });

  it("promotes [Unreleased] to versioned release with no pending changeset files", async () => {
    const { dir, vsDir } = makeProject("promote-unreleased");

    // Simulate a prior `release` (no --version) that left content in [Unreleased]
    const existing = `# Changelog

All notable changes.

## [Unreleased]

### Added

- Dark mode support.

### Fixed

- Login redirect loop.
`;
    writeFileSync(join(dir, "CHANGELOG.md"), existing, "utf-8");
    // No changeset files — .versionsmith is empty

    await release({ cwd: dir, version: "1.0.0", date: "2026-03-20" });

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf-8");
    assert.ok(content.includes("## [1.0.0] - 2026-03-20"));
    assert.ok(content.includes("- Dark mode support."));
    assert.ok(content.includes("- Login redirect loop."));
    // [Unreleased] should be left empty at top
    assert.ok(content.includes("## [Unreleased]"));
    const unreleasedPos = content.indexOf("## [Unreleased]");
    const versionPos = content.indexOf("## [1.0.0]");
    assert.ok(unreleasedPos < versionPos);
  });

  it("removes ALL changeset files after release", async () => {
    const { dir, vsDir } = makeProject("cleanup");

    writeFileSync(join(vsDir, "a.md"), "### Added\n\n- A.\n", "utf-8");
    writeFileSync(join(vsDir, "b.md"), "### Fixed\n\n- B.\n", "utf-8");
    writeFileSync(join(vsDir, "c.md"), "### Changed\n\n- C.\n", "utf-8");

    await release({ cwd: dir, version: "3.0.0", date: "2026-03-20" });

    assert.ok(!existsSync(join(vsDir, "a.md")));
    assert.ok(!existsSync(join(vsDir, "b.md")));
    assert.ok(!existsSync(join(vsDir, "c.md")));
  });
});

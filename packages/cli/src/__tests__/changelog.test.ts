import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseChangeset,
  mergeChangesets,
  parseChangelog,
  renderChangelog,
  insertUnreleased,
  promoteToRelease,
  renderEntries,
} from "../utils/changelog.ts";

// ---------------------------------------------------------------------------
// parseChangeset
// ---------------------------------------------------------------------------
describe("parseChangeset", () => {
  it("parses a single type", () => {
    const content = `### Added\n\n- New feature.\n`;
    const cs = parseChangeset(content);
    assert.deepEqual(cs.entries, { Added: ["New feature."] });
  });

  it("parses multiple types", () => {
    const content = `### Added\n\n- Feature A.\n\n### Fixed\n\n- Bug B.\n`;
    const cs = parseChangeset(content);
    assert.deepEqual(cs.entries, { Added: ["Feature A."], Fixed: ["Bug B."] });
  });

  it("parses multiple items under one type", () => {
    const content = `### Changed\n\n- Change 1.\n- Change 2.\n`;
    const cs = parseChangeset(content);
    assert.deepEqual(cs.entries, { Changed: ["Change 1.", "Change 2."] });
  });

  it("returns empty entries for empty content", () => {
    const cs = parseChangeset("");
    assert.deepEqual(cs.entries, {});
  });
});

// ---------------------------------------------------------------------------
// mergeChangesets
// ---------------------------------------------------------------------------
describe("mergeChangesets", () => {
  it("merges two changesets", () => {
    const a = parseChangeset("### Added\n\n- A.\n");
    const b = parseChangeset("### Added\n\n- B.\n### Fixed\n\n- Fix.\n");
    const merged = mergeChangesets([a, b]);
    assert.deepEqual(merged, { Added: ["A.", "B."], Fixed: ["Fix."] });
  });

  it("returns empty for empty input", () => {
    assert.deepEqual(mergeChangesets([]), {});
  });
});

// ---------------------------------------------------------------------------
// renderEntries
// ---------------------------------------------------------------------------
describe("renderEntries", () => {
  it("renders entries in canonical order", () => {
    const entries = { Fixed: ["A bug."], Added: ["A feature."] };
    const rendered = renderEntries(entries);
    // Added should come before Fixed in the output
    const addedIdx = rendered.indexOf("### Added");
    const fixedIdx = rendered.indexOf("### Fixed");
    assert.ok(addedIdx < fixedIdx, "Added should appear before Fixed");
    assert.ok(rendered.includes("- A feature."));
    assert.ok(rendered.includes("- A bug."));
  });

  it("returns empty string for empty entries", () => {
    assert.equal(renderEntries({}), "");
  });
});

// ---------------------------------------------------------------------------
// parseChangelog
// ---------------------------------------------------------------------------
describe("parseChangelog", () => {
  const SAMPLE = `# Changelog

All notable changes.

## [Unreleased]

### Added

- Unreleased thing.

## [1.0.0] - 2026-01-01

### Fixed

- Fixed something.
`;

  it("extracts the header", () => {
    const { header } = parseChangelog(SAMPLE);
    assert.ok(header.includes("# Changelog"));
    assert.ok(header.includes("All notable changes."));
  });

  it("parses releases in order", () => {
    const { releases } = parseChangelog(SAMPLE);
    assert.equal(releases.length, 2);
    assert.equal(releases[0].version, "Unreleased");
    assert.equal(releases[1].version, "1.0.0");
    assert.equal(releases[1].date, "2026-01-01");
  });

  it("parses entries within releases", () => {
    const { releases } = parseChangelog(SAMPLE);
    assert.deepEqual(releases[0].entries.Added, ["Unreleased thing."]);
    assert.deepEqual(releases[1].entries.Fixed, ["Fixed something."]);
  });

  it("handles changelog with no releases", () => {
    const { header, releases } = parseChangelog("# Changelog\n\nSome header.\n");
    assert.ok(header.includes("# Changelog"));
    assert.equal(releases.length, 0);
  });
});

// ---------------------------------------------------------------------------
// renderChangelog
// ---------------------------------------------------------------------------
describe("renderChangelog", () => {
  it("round-trips a simple changelog", () => {
    const header = "# Changelog\n\nAll notable changes.";
    const releases = [
      {
        version: "Unreleased",
        entries: { Added: ["Something new."] },
      },
    ];
    const rendered = renderChangelog(header, releases);
    assert.ok(rendered.includes("## [Unreleased]"));
    assert.ok(rendered.includes("### Added"));
    assert.ok(rendered.includes("- Something new."));
    assert.ok(rendered.endsWith("\n"));
  });

  it("does not produce more than 2 consecutive blank lines", () => {
    const header = "# Changelog";
    const releases = [
      { version: "Unreleased", entries: {} },
      { version: "1.0.0", date: "2026-01-01", entries: { Fixed: ["Bug."] } },
    ];
    const rendered = renderChangelog(header, releases);
    assert.doesNotMatch(rendered, /\n{3,}/);
  });
});

// ---------------------------------------------------------------------------
// insertUnreleased
// ---------------------------------------------------------------------------
describe("insertUnreleased", () => {
  it("creates [Unreleased] if none exists", () => {
    const parsed = { header: "# Changelog", releases: [] };
    const result = insertUnreleased(parsed, { Added: ["New thing."] });
    assert.equal(result.releases.length, 1);
    assert.equal(result.releases[0].version, "Unreleased");
    assert.deepEqual(result.releases[0].entries.Added, ["New thing."]);
  });

  it("appends to existing [Unreleased]", () => {
    const parsed = {
      header: "# Changelog",
      releases: [{ version: "Unreleased", entries: { Added: ["Old."] } }],
    };
    const result = insertUnreleased(parsed, { Added: ["New."] });
    assert.deepEqual(result.releases[0].entries.Added, ["Old.", "New."]);
  });

  it("does not disturb other releases", () => {
    const parsed = {
      header: "# Changelog",
      releases: [
        { version: "Unreleased", entries: {} },
        { version: "1.0.0", date: "2026-01-01", entries: { Fixed: ["X."] } },
      ],
    };
    const result = insertUnreleased(parsed, { Security: ["Patch."] });
    assert.equal(result.releases.length, 2);
    assert.equal(result.releases[1].version, "1.0.0");
  });
});

// ---------------------------------------------------------------------------
// promoteToRelease
// ---------------------------------------------------------------------------
describe("promoteToRelease", () => {
  it("converts Unreleased to a versioned release", () => {
    const parsed = {
      header: "# Changelog",
      releases: [{ version: "Unreleased", entries: { Added: ["Feature."] } }],
    };
    const result = promoteToRelease(parsed, "1.0.0", "2026-03-20", {});
    // Should have empty Unreleased + new versioned
    assert.equal(result.releases.length, 2);
    assert.equal(result.releases[0].version, "Unreleased");
    assert.deepEqual(result.releases[0].entries, {});
    assert.equal(result.releases[1].version, "1.0.0");
    assert.equal(result.releases[1].date, "2026-03-20");
    assert.deepEqual(result.releases[1].entries.Added, ["Feature."]);
  });

  it("merges new entries with existing Unreleased", () => {
    const parsed = {
      header: "# Changelog",
      releases: [{ version: "Unreleased", entries: { Added: ["Old."] } }],
    };
    const result = promoteToRelease(parsed, "2.0.0", "2026-03-20", {
      Fixed: ["New fix."],
    });
    const versioned = result.releases.find((r) => r.version === "2.0.0")!;
    assert.deepEqual(versioned.entries.Added, ["Old."]);
    assert.deepEqual(versioned.entries.Fixed, ["New fix."]);
  });

  it("creates a versioned release even with no prior Unreleased", () => {
    const parsed = { header: "# Changelog", releases: [] };
    const result = promoteToRelease(parsed, "1.0.0", "2026-03-20", {
      Added: ["Initial release."],
    });
    const versioned = result.releases.find((r) => r.version === "1.0.0")!;
    assert.ok(versioned);
    assert.deepEqual(versioned.entries.Added, ["Initial release."]);
  });
});

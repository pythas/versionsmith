import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseChangeset,
  mergeChangesets,
  renderEntries,
} from "../utils/changelog.ts";

/**
 * These tests verify the append-on-add behavior:
 * when a user runs `add` a second time, new entries should merge
 * with existing changeset file content rather than losing them.
 *
 * Since `add()` itself is interactive (inquirer prompts), we test
 * the underlying merge logic that powers the append behavior.
 */

const TMP_BASE = join(tmpdir(), "versionsmith-add-append-test");

function makeVsDir(name: string) {
  const dir = join(TMP_BASE, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("add command append behavior", () => {
  before(() => mkdirSync(TMP_BASE, { recursive: true }));
  after(() => {
    rmSync(TMP_BASE, { recursive: true, force: true });
  });

  describe("detecting existing changeset files", () => {
    it("finds .md files excluding .gitkeep", () => {
      const dir = makeVsDir("detect-files");
      writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
      writeFileSync(join(dir, "brave-delta.md"), "### Added\n\n- Feature.\n", "utf-8");

      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      );
      assert.equal(files.length, 1);
      assert.equal(files[0], "brave-delta.md");
    });

    it("returns empty list when only .gitkeep exists", () => {
      const dir = makeVsDir("no-files");
      writeFileSync(join(dir, ".gitkeep"), "", "utf-8");

      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      );
      assert.equal(files.length, 0);
    });

    it("finds multiple .md files", () => {
      const dir = makeVsDir("multi-files");
      writeFileSync(join(dir, "a.md"), "### Added\n\n- A.\n", "utf-8");
      writeFileSync(join(dir, "b.md"), "### Fixed\n\n- B.\n", "utf-8");

      const files = readdirSync(dir).filter(
        (f) => f.endsWith(".md") && f !== ".gitkeep"
      );
      assert.equal(files.length, 2);
    });
  });

  describe("merging existing entries with new entries", () => {
    it("appends new entries of the same type after existing ones", () => {
      const existingContent = "### Added\n\n- Existing feature.\n";
      const existingEntries = parseChangeset(existingContent).entries;
      const newEntries = { Added: ["New feature."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);

      assert.deepEqual(merged.Added, ["Existing feature.", "New feature."]);
    });

    it("preserves existing types not present in new entries", () => {
      const existingContent = "### Added\n\n- Feature A.\n\n### Fixed\n\n- Bug fix.\n";
      const existingEntries = parseChangeset(existingContent).entries;
      const newEntries = { Added: ["Feature B."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);

      assert.deepEqual(merged.Added, ["Feature A.", "Feature B."]);
      assert.deepEqual(merged.Fixed, ["Bug fix."]);
    });

    it("adds new types not present in existing entries", () => {
      const existingContent = "### Added\n\n- Feature.\n";
      const existingEntries = parseChangeset(existingContent).entries;
      const newEntries = { Security: ["CVE patch."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);

      assert.deepEqual(merged.Added, ["Feature."]);
      assert.deepEqual(merged.Security, ["CVE patch."]);
    });

    it("handles empty existing entries gracefully", () => {
      const existingEntries = {};
      const newEntries = { Added: ["Brand new."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);

      assert.deepEqual(merged.Added, ["Brand new."]);
    });
  });

  describe("round-trip: parse, merge, render, re-parse", () => {
    it("produces a valid changeset file after merging", () => {
      const existingContent = "### Added\n\n- Feature A.\n\n### Fixed\n\n- Bug B.\n";
      const existingEntries = parseChangeset(existingContent).entries;
      const newEntries = { Added: ["Feature C."], Changed: ["API updated."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);

      const rendered = renderEntries(merged);

      // Re-parse the rendered output to verify it's valid
      const reParsed = parseChangeset(rendered);
      assert.deepEqual(reParsed.entries.Added, ["Feature A.", "Feature C."]);
      assert.deepEqual(reParsed.entries.Fixed, ["Bug B."]);
      assert.deepEqual(reParsed.entries.Changed, ["API updated."]);
    });

    it("writes merged content to file and reads it back correctly", () => {
      const dir = makeVsDir("round-trip");
      const filePath = join(dir, "test-entry.md");

      // Simulate first add
      const firstEntries = { Added: ["Feature 1."] };
      writeFileSync(filePath, renderEntries(firstEntries), "utf-8");

      // Simulate second add (appending)
      const existingContent = readFileSync(filePath, "utf-8");
      const existingEntries = parseChangeset(existingContent).entries;
      const newEntries = { Added: ["Feature 2."], Fixed: ["Bug fix."] };

      const merged = mergeChangesets([
        { entries: existingEntries },
        { entries: newEntries },
      ]);
      writeFileSync(filePath, renderEntries(merged), "utf-8");

      // Verify final file
      const finalContent = readFileSync(filePath, "utf-8");
      const finalParsed = parseChangeset(finalContent);
      assert.deepEqual(finalParsed.entries.Added, ["Feature 1.", "Feature 2."]);
      assert.deepEqual(finalParsed.entries.Fixed, ["Bug fix."]);
    });

    it("survives three consecutive appends", () => {
      const dir = makeVsDir("triple-append");
      const filePath = join(dir, "entry.md");

      // First add
      const first = { Added: ["Feature 1."] };
      writeFileSync(filePath, renderEntries(first), "utf-8");

      // Second add
      const content2 = readFileSync(filePath, "utf-8");
      const merged2 = mergeChangesets([
        { entries: parseChangeset(content2).entries },
        { entries: { Added: ["Feature 2."], Fixed: ["Bug 1."] } },
      ]);
      writeFileSync(filePath, renderEntries(merged2), "utf-8");

      // Third add
      const content3 = readFileSync(filePath, "utf-8");
      const merged3 = mergeChangesets([
        { entries: parseChangeset(content3).entries },
        { entries: { Security: ["CVE fix."] } },
      ]);
      writeFileSync(filePath, renderEntries(merged3), "utf-8");

      // Verify final state
      const final = parseChangeset(readFileSync(filePath, "utf-8"));
      assert.deepEqual(final.entries.Added, ["Feature 1.", "Feature 2."]);
      assert.deepEqual(final.entries.Fixed, ["Bug 1."]);
      assert.deepEqual(final.entries.Security, ["CVE fix."]);
    });
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseInlineEntries } from "../utils/args.ts";
import { addInline } from "../commands/add.ts";
import { writeConfig, DEFAULT_CONFIG } from "../utils/config.ts";
import { parseChangeset } from "../utils/changelog.ts";

const TMP_BASE = join(tmpdir(), "versionsmith-inline-add-test");

function makeProject(name: string) {
  const cwd = join(TMP_BASE, name);
  const vsDir = join(cwd, ".versionsmith");
  mkdirSync(vsDir, { recursive: true });
  writeConfig(DEFAULT_CONFIG, cwd);
  writeFileSync(join(vsDir, ".gitkeep"), "", "utf-8");
  return { cwd, vsDir };
}

describe("parseInlineEntries", () => {
  it("parses a single type-description pair", () => {
    const result = parseInlineEntries(["added", "Dark mode"]);
    assert.deepEqual(result, { Added: ["Dark mode"] });
  });

  it("parses multiple pairs of different types", () => {
    const result = parseInlineEntries([
      "added", "Dark mode",
      "fixed", "Login bug",
    ]);
    assert.deepEqual(result, {
      Added: ["Dark mode"],
      Fixed: ["Login bug"],
    });
  });

  it("groups multiple entries of the same type", () => {
    const result = parseInlineEntries([
      "added", "Feature A",
      "added", "Feature B",
    ]);
    assert.deepEqual(result, { Added: ["Feature A", "Feature B"] });
  });

  it("handles case-insensitive type names", () => {
    const result = parseInlineEntries(["ADDED", "Feature"]);
    assert.deepEqual(result, { Added: ["Feature"] });

    const result2 = parseInlineEntries(["Fixed", "Bug"]);
    assert.deepEqual(result2, { Fixed: ["Bug"] });

    const result3 = parseInlineEntries(["sEcUrItY", "CVE patch"]);
    assert.deepEqual(result3, { Security: ["CVE patch"] });
  });

  it("parses all six change types", () => {
    const result = parseInlineEntries([
      "added", "A",
      "changed", "B",
      "deprecated", "C",
      "removed", "D",
      "fixed", "E",
      "security", "F",
    ]);
    assert.deepEqual(result, {
      Added: ["A"],
      Changed: ["B"],
      Deprecated: ["C"],
      Removed: ["D"],
      Fixed: ["E"],
      Security: ["F"],
    });
  });

  it("trims whitespace from descriptions", () => {
    const result = parseInlineEntries(["added", "  padded  "]);
    assert.deepEqual(result, { Added: ["padded"] });
  });

  it("throws on invalid change type", () => {
    assert.throws(
      () => parseInlineEntries(["potato", "something"]),
      (err: Error) => {
        assert.match(err.message, /not a valid change type/);
        assert.match(err.message, /potato/);
        return true;
      }
    );
  });

  it("throws when description is missing after type", () => {
    assert.throws(
      () => parseInlineEntries(["added"]),
      (err: Error) => {
        assert.match(err.message, /Missing description after/);
        return true;
      }
    );
  });

  it("throws when second pair has missing description", () => {
    assert.throws(
      () => parseInlineEntries(["added", "Feature", "fixed"]),
      (err: Error) => {
        assert.match(err.message, /Missing description after/);
        return true;
      }
    );
  });

  it("throws on invalid type in second pair position", () => {
    assert.throws(
      () => parseInlineEntries(["added", "Feature", "nope", "Bug"]),
      (err: Error) => {
        assert.match(err.message, /not a valid change type/);
        assert.match(err.message, /nope/);
        return true;
      }
    );
  });

  it("throws on empty args", () => {
    assert.throws(
      () => parseInlineEntries([]),
      (err: Error) => {
        assert.match(err.message, /No entries provided/);
        return true;
      }
    );
  });
});

describe("addInline", () => {
  before(() => mkdirSync(TMP_BASE, { recursive: true }));
  after(() => rmSync(TMP_BASE, { recursive: true, force: true }));

  it("creates a new changeset file with correct content", async () => {
    const { cwd, vsDir } = makeProject("basic");

    await addInline({ Added: ["Dark mode"] }, cwd);

    const files = readdirSync(vsDir).filter(
      (f) => f.endsWith(".md") && f !== ".gitkeep"
    );
    assert.equal(files.length, 1);

    const content = readFileSync(join(vsDir, files[0]), "utf-8");
    const parsed = parseChangeset(content);
    assert.deepEqual(parsed.entries.Added, ["Dark mode"]);
  });

  it("creates a file with multiple entry types", async () => {
    const { cwd, vsDir } = makeProject("multi-type");

    await addInline(
      { Added: ["Feature"], Fixed: ["Bug"], Changed: ["API"] },
      cwd
    );

    const files = readdirSync(vsDir).filter(
      (f) => f.endsWith(".md") && f !== ".gitkeep"
    );
    assert.equal(files.length, 1);

    const content = readFileSync(join(vsDir, files[0]), "utf-8");
    const parsed = parseChangeset(content);
    assert.deepEqual(parsed.entries.Added, ["Feature"]);
    assert.deepEqual(parsed.entries.Changed, ["API"]);
    assert.deepEqual(parsed.entries.Fixed, ["Bug"]);
  });

  it("appends to the single existing file", async () => {
    const { cwd, vsDir } = makeProject("append-single");

    // Pre-existing changeset file
    writeFileSync(
      join(vsDir, "existing.md"),
      "### Added\n\n- Old feature.\n",
      "utf-8"
    );

    await addInline({ Fixed: ["New bug fix"] }, cwd);

    const files = readdirSync(vsDir).filter(
      (f) => f.endsWith(".md") && f !== ".gitkeep"
    );
    assert.equal(files.length, 1, "should not create a second file");
    assert.equal(files[0], "existing.md");

    const content = readFileSync(join(vsDir, "existing.md"), "utf-8");
    const parsed = parseChangeset(content);
    assert.deepEqual(parsed.entries.Added, ["Old feature."]);
    assert.deepEqual(parsed.entries.Fixed, ["New bug fix"]);
  });

  it("merges same-type entries when appending to existing file", async () => {
    const { cwd, vsDir } = makeProject("append-merge");

    writeFileSync(
      join(vsDir, "existing.md"),
      "### Added\n\n- Feature A.\n",
      "utf-8"
    );

    await addInline({ Added: ["Feature B"] }, cwd);

    const content = readFileSync(join(vsDir, "existing.md"), "utf-8");
    const parsed = parseChangeset(content);
    assert.deepEqual(parsed.entries.Added, ["Feature A.", "Feature B"]);
  });

  it("creates a new file when multiple already exist", async () => {
    const { cwd, vsDir } = makeProject("no-append-multi");

    writeFileSync(join(vsDir, "a.md"), "### Added\n\n- A.\n", "utf-8");
    writeFileSync(join(vsDir, "b.md"), "### Fixed\n\n- B.\n", "utf-8");

    await addInline({ Changed: ["Something changed"] }, cwd);

    const files = readdirSync(vsDir).filter(
      (f) => f.endsWith(".md") && f !== ".gitkeep"
    );
    assert.equal(files.length, 3);
  });

  it("creates multiple entries of the same type", async () => {
    const { cwd, vsDir } = makeProject("same-type");

    await addInline({ Added: ["Feature A", "Feature B"] }, cwd);

    const files = readdirSync(vsDir).filter(
      (f) => f.endsWith(".md") && f !== ".gitkeep"
    );
    assert.equal(files.length, 1);

    const content = readFileSync(join(vsDir, files[0]), "utf-8");
    const parsed = parseChangeset(content);
    assert.deepEqual(parsed.entries.Added, ["Feature A", "Feature B"]);
  });
});

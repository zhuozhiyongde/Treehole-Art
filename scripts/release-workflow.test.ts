import { describe, expect, test } from "bun:test";
import {
  createChangelogDraft,
  nextPatchVersion,
  releaseNotesFor,
} from "./release-workflow";

describe("release workflow", () => {
  test("creates a complete changelog skeleton when the file is missing", () => {
    expect(createChangelogDraft("1.2.3", "", "2026-09-15")).toBe(
      "# CHANGELOG\n\n## [1.2.3] - 2026-09-15\n\n",
    );
  });

  test("inserts the current version above existing entries", () => {
    const changelog = "# CHANGELOG\n\n## [1.2.2] - 2026-09-14\n\n- Fix\n";
    expect(createChangelogDraft("1.2.3", changelog, "2026-09-15")).toBe(
      "# CHANGELOG\n\n## [1.2.3] - 2026-09-15\n\n" +
        "## [1.2.2] - 2026-09-14\n\n- Fix\n",
    );
  });

  test("does not duplicate an existing version", () => {
    const changelog = "# CHANGELOG\n\n## [1.2.3] - 2026-09-15\n\n- Fix\n";
    expect(
      createChangelogDraft("1.2.3", changelog, "2026-09-15"),
    ).toBeUndefined();
  });

  test("requires package.json to match the latest changelog entry", () => {
    const changelog =
      "# CHANGELOG\n\n## [1.2.4] - 2026-09-15\n\n- New\n\n" +
      "## [1.2.3] - 2026-09-14\n\n- Old\n";
    expect(() => releaseNotesFor("1.2.3", changelog)).toThrow(
      "package.json=1.2.3，CHANGELOG.md=1.2.4",
    );
  });

  test("extracts the latest release notes", () => {
    const changelog =
      "# CHANGELOG\n\n## [1.2.3] - 2026-09-15\n\n- New\n\n" +
      "## [1.2.2] - 2026-09-14\n\n- Old\n";
    expect(releaseNotesFor("1.2.3", changelog)).toBe("- New");
  });

  test("advances the patch version", () => {
    expect(nextPatchVersion("1.2.3")).toBe("1.2.4");
  });
});

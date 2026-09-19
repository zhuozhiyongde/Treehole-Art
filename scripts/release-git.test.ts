import { describe, expect, test } from "bun:test";
import {
  commitReleaseChanges,
  type GitCommandResult,
  type RunGitCommand,
} from "./release-git";

const success: GitCommandResult = { exitCode: 0, stderr: "", stdout: "" };

describe("release git workflow", () => {
  test("commits the changelog and existing staged changes with a GPG signature", async () => {
    const calls: Parameters<RunGitCommand>[] = [];
    const run: RunGitCommand = async (...parameters) => {
      calls.push(parameters);
      if (parameters[0][1] === "diff") {
        return { ...success, exitCode: 1 };
      }
      return success;
    };

    await expect(commitReleaseChanges("1.2.3", run)).resolves.toBe(true);
    expect(calls).toEqual([
      [["git", "add", "--", "CHANGELOG.md"]],
      [
        ["git", "diff", "--cached", "--quiet"],
        { allowFailure: true, capture: true },
      ],
      [["git", "commit", "-S", "-m", "👷 ci: V1.2.3"]],
    ]);
  });

  test("does not create an empty release commit", async () => {
    const calls: Parameters<RunGitCommand>[] = [];
    const run: RunGitCommand = async (...parameters) => {
      calls.push(parameters);
      return success;
    };

    await expect(commitReleaseChanges("1.2.3", run)).resolves.toBe(false);
    expect(calls).toHaveLength(2);
  });

  test("reports failures while inspecting the index", async () => {
    const run: RunGitCommand = async (command) =>
      command[1] === "diff"
        ? { exitCode: 128, stderr: "bad index", stdout: "" }
        : success;

    await expect(commitReleaseChanges("1.2.3", run)).rejects.toThrow(
      "无法检查 Git 暂存区：bad index",
    );
  });
});

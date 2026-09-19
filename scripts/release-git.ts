export type GitCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type RunGitCommand = (
  command: string[],
  options?: { allowFailure?: boolean; capture?: boolean },
) => Promise<GitCommandResult>;

export async function commitReleaseChanges(
  targetVersion: string,
  run: RunGitCommand,
): Promise<boolean> {
  console.log("[Git] 暂存 CHANGELOG.md");
  await run(["git", "add", "--", "CHANGELOG.md"]);

  const stagedChanges = await run(
    ["git", "diff", "--cached", "--quiet"],
    { allowFailure: true, capture: true },
  );
  if (stagedChanges.exitCode === 0) {
    console.log("[Git] 暂存区没有改动，跳过发布提交");
    return false;
  }
  if (stagedChanges.exitCode !== 1) {
    throw new Error(
      `无法检查 Git 暂存区：${
        stagedChanges.stderr || stagedChanges.stdout || "git diff 执行失败"
      }`,
    );
  }

  const message = `👷 ci: V${targetVersion}`;
  console.log(`[Git] 创建 GPG 签名提交：${message}`);
  await run(["git", "commit", "-S", "-m", message]);
  return true;
}

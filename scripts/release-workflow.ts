function changelogHeadings(changelog: string): RegExpMatchArray[] {
  return [...changelog.matchAll(/^##\s+\[([^\]]+)\].*$/gm)];
}

export function releaseNotesFor(
  targetVersion: string,
  changelog: string,
): string {
  const headings = changelogHeadings(changelog);
  const latestVersion = headings[0]?.[1];
  if (latestVersion !== targetVersion) {
    throw new Error(
      `版本与 CHANGELOG.md 不匹配：package.json=${targetVersion}，` +
        `CHANGELOG.md=${latestVersion || "未找到版本条目"}`,
    );
  }

  const heading = headings[0];
  const start = (heading.index ?? 0) + heading[0].length;
  const end = headings[1]?.index ?? changelog.length;
  const notes = changelog.slice(start, end).trim();
  if (!notes) {
    throw new Error(`CHANGELOG.md 中 ${targetVersion} 的发布说明为空`);
  }
  return notes;
}

export function createChangelogDraft(
  targetVersion: string,
  changelog: string,
  date: string,
): string | undefined {
  if (
    changelogHeadings(changelog).some((heading) => heading[1] === targetVersion)
  ) {
    return undefined;
  }

  const entry = `## [${targetVersion}] - ${date}\n\n`;
  const title = changelog.match(/^#\s+CHANGELOG\s*$/im);
  let updated: string;

  if (!changelog.trim()) {
    updated = `# CHANGELOG\n\n${entry}`;
  } else if (title?.index !== undefined) {
    const titleEnd = title.index + title[0].length;
    updated = `${changelog.slice(0, titleEnd).trimEnd()}\n\n${entry}${changelog
      .slice(titleEnd)
      .trimStart()}`;
  } else {
    updated = `# CHANGELOG\n\n${entry}${changelog.trimStart()}`;
  }

  return updated.endsWith("\n") ? updated : `${updated}\n`;
}

export function nextPatchVersion(currentVersion: string): string {
  const match = currentVersion.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/,
  );
  if (!match) {
    throw new Error(`无法推进非 SemVer 版本：${currentVersion}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

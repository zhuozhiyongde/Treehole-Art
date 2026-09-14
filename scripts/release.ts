import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type DogeCloudResponse<T> = {
  code: number;
  data: T;
  msg?: string;
};

type TemporaryCredentials = {
  Credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
};

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const artifactPath = fileURLToPath(
  new URL("../dist/Treehole-Art.user.js", import.meta.url),
);
const packageJson = (await Bun.file(
  new URL("../package.json", import.meta.url),
).json()) as { version: string };

const args = new Set(process.argv.slice(2));
const dryRun = args.delete("--dry-run");
const cdnOnly = args.delete("--cdn-only");

if (args.has("--help") || args.has("-h")) {
  console.log(`用法：bun run release -- [选项]

选项：
  --dry-run   运行测试和构建并校验产物，不上传或创建 Release
  --cdn-only  只发布到 CDN，不创建 GitHub Release
  --help      显示帮助`);
  process.exit(0);
}

if (args.size > 0) {
  throw new Error(`未知参数：${[...args].join(", ")}`);
}

const version = packageJson.version;
const tag = `v${version}`;
const bucket = process.env.CDN_BUCKET || "CDN_BUCKET_REDACTED";
const endpoint =
  process.env.CDN_ENDPOINT || "CDN_ENDPOINT_REDACTED";
const region = process.env.CDN_REGION || "ap-beijing";
const objectKey =
  process.env.CDN_OBJECT_KEY || "release/Treehole-Art.user.js";
const publicUrl =
  process.env.CDN_PUBLIC_URL ||
  "https://cdn.arthals.ink/release/Treehole-Art.user.js";
const refreshUrl = process.env.CDN_REFRESH_URL || publicUrl;
const githubRepository =
  process.env.GITHUB_REPOSITORY || "zhuozhiyongde/Treehole-Art";

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}；请根据 .env.example 配置 .env`);
  }
  return value;
}

function commandEnvironment(command: string): Record<string, string | undefined> {
  if (
    command === "gh" &&
    process.env.GITHUB_TOKEN &&
    !process.env.GH_TOKEN
  ) {
    return { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN };
  }
  return process.env;
}

async function run(
  command: string[],
  options: { allowFailure?: boolean; capture?: boolean } = {},
): Promise<CommandResult> {
  const capture = options.capture ?? false;
  const processHandle = Bun.spawn(command, {
    cwd: projectRoot,
    env: commandEnvironment(command[0]),
    stdin: "inherit",
    stdout: capture ? "pipe" : "inherit",
    stderr: capture ? "pipe" : "inherit",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    capture ? new Response(processHandle.stdout).text() : Promise.resolve(""),
    capture ? new Response(processHandle.stderr).text() : Promise.resolve(""),
  ]);

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(`命令执行失败：${command.join(" ")}`);
  }

  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function dogeCloudApi<T>(
  apiPath: string,
  data: Record<string, unknown>,
  jsonMode = false,
): Promise<T> {
  const accessKey = requireEnvironment("DOGECLOUD_ACCESS_KEY");
  const secretKey = requireEnvironment("DOGECLOUD_SECRET_KEY");
  const body = jsonMode
    ? JSON.stringify(data)
    : new URLSearchParams(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      ).toString();
  const contentType = jsonMode
    ? "application/json"
    : "application/x-www-form-urlencoded";
  const signature = createHmac("sha1", secretKey)
    .update(`${apiPath}\n${body}`)
    .digest("hex");

  const response = await fetch(`https://api.dogecloud.com${apiPath}`, {
    method: "POST",
    body,
    headers: {
      Authorization: `TOKEN ${accessKey}:${signature}`,
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    throw new Error(`多吉云 API 请求失败：HTTP ${response.status}`);
  }

  const result = (await response.json()) as DogeCloudResponse<T>;
  if (result.code !== 200) {
    throw new Error(`多吉云 API 请求失败：${result.msg || result.code}`);
  }
  return result.data;
}

function releaseNotesFor(targetVersion: string, changelog: string): string {
  const headings = [...changelog.matchAll(/^##\s+\[([^\]]+)\].*$/gm)];
  const headingIndex = headings.findIndex((match) => match[1] === targetVersion);
  if (headingIndex === -1) {
    throw new Error(`CHANGELOG.md 中没有 ${targetVersion} 的二级标题`);
  }

  const heading = headings[headingIndex];
  const start = (heading.index ?? 0) + heading[0].length;
  const end = headings[headingIndex + 1]?.index ?? changelog.length;
  const notes = changelog.slice(start, end).trim();
  if (!notes) {
    throw new Error(`CHANGELOG.md 中 ${targetVersion} 的发布说明为空`);
  }
  return notes;
}

async function validateArtifact(): Promise<void> {
  const artifact = Bun.file(artifactPath);
  if (!(await artifact.exists())) {
    throw new Error(`构建产物不存在：${artifactPath}`);
  }

  const content = await artifact.text();
  const builtVersion = content.match(/^\/\/ @version\s+(\S+)$/m)?.[1];
  if (builtVersion !== version) {
    throw new Error(
      `产物版本不一致：package.json=${version}，userscript=${builtVersion || "未找到"}`,
    );
  }
  if (!content.includes(`// @downloadURL  ${publicUrl}`)) {
    throw new Error("构建产物中的 @downloadURL 与 CDN_PUBLIC_URL 不一致");
  }
  if (!content.includes(`// @updateURL    ${publicUrl}`)) {
    throw new Error("构建产物中的 @updateURL 与 CDN_PUBLIC_URL 不一致");
  }
}

async function validateGitHubRelease(): Promise<{
  commit: string;
  existingDraft: boolean;
}> {
  await run(["gh", "auth", "status", "--hostname", "github.com"]);

  const status = await run(["git", "status", "--porcelain"], {
    capture: true,
  });
  if (status.stdout) {
    throw new Error("工作区存在未提交修改；请先提交本次版本的代码与日志");
  }

  const branch = (
    await run(["git", "branch", "--show-current"], { capture: true })
  ).stdout;
  const commit = (await run(["git", "rev-parse", "HEAD"], { capture: true }))
    .stdout;
  const remote = await run(
    ["git", "ls-remote", "origin", `refs/heads/${branch}`],
    { capture: true },
  );
  const remoteCommit = remote.stdout.split(/\s+/)[0];
  if (!branch || remoteCommit !== commit) {
    throw new Error("当前提交尚未推送到 origin；请先 git push 再发布");
  }

  const currentRelease = await run(
    [
      "gh",
      "release",
      "view",
      tag,
      "--repo",
      githubRepository,
      "--json",
      "isDraft",
    ],
    { allowFailure: true, capture: true },
  );
  if (currentRelease.exitCode === 0) {
    const { isDraft } = JSON.parse(currentRelease.stdout) as { isDraft: boolean };
    if (!isDraft) {
      throw new Error(`GitHub Release ${tag} 已存在，拒绝重复发布`);
    }
    return { commit, existingDraft: true };
  }

  return { commit, existingDraft: false };
}

async function publishGitHubDraft(
  notes: string,
  commit: string,
  existingDraft: boolean,
): Promise<void> {
  const asset = `${artifactPath}#Treehole-Art.user.js`;
  if (existingDraft) {
    console.log(`[GitHub] 更新已有草稿 ${tag}`);
    await run([
      "gh",
      "release",
      "upload",
      tag,
      asset,
      "--repo",
      githubRepository,
      "--clobber",
    ]);
    return;
  }

  console.log(`[GitHub] 创建草稿 ${tag}`);
  await run([
    "gh",
    "release",
    "create",
    tag,
    asset,
    "--repo",
    githubRepository,
    "--target",
    commit,
    "--title",
    `Treehole-Art ${tag}`,
    "--notes",
    notes,
    "--draft",
  ]);
}

async function uploadToCdn(): Promise<void> {
  console.log(`[CDN] 获取临时上传凭据`);
  const { Credentials: credentials } = await dogeCloudApi<TemporaryCredentials>(
    "/auth/tmp_token.json",
    { channel: "OSS_FULL", scopes: ["*"] },
    true,
  );

  console.log(`[CDN] 上传 ${artifactPath} -> s3://${bucket}/${objectKey}`);
  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  try {
    const body = new Uint8Array(await Bun.file(artifactPath).arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        CacheControl: "public, max-age=300",
        ContentType: "application/javascript; charset=utf-8",
      }),
    );
  } finally {
    client.destroy();
  }

  console.log(`[CDN] 刷新 ${refreshUrl}`);
  const refresh = await dogeCloudApi<{ task_id: string }>(
    "/cdn/refresh/add.json",
    { rtype: "path", urls: JSON.stringify([refreshUrl]) },
  );
  console.log(`[CDN] 刷新任务：${refresh.task_id}`);
}

async function main(): Promise<void> {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 中的版本号不是合法 SemVer：${version}`);
  }

  const changelog = await Bun.file(
    new URL("../CHANGELOG.md", import.meta.url),
  ).text();
  const notes = releaseNotesFor(version, changelog);

  let githubState: { commit: string; existingDraft: boolean } | undefined;
  if (!dryRun) {
    requireEnvironment("DOGECLOUD_ACCESS_KEY");
    requireEnvironment("DOGECLOUD_SECRET_KEY");
    if (!cdnOnly) {
      githubState = await validateGitHubRelease();
    }
  }

  console.log(`[Release] Treehole-Art ${tag}`);
  console.log("[检查] 运行测试");
  await run(["bun", "test"]);
  console.log("[构建] 生成用户脚本");
  await run(["bun", "run", "build:userscript"]);
  await validateArtifact();

  if (dryRun) {
    console.log(`[演练完成] 将上传到 ${publicUrl}`);
    if (!cdnOnly) {
      console.log(`[演练完成] 将创建 GitHub Release ${tag}`);
    }
    return;
  }

  if (githubState) {
    await publishGitHubDraft(
      notes,
      githubState.commit,
      githubState.existingDraft,
    );
  }

  await uploadToCdn();

  if (githubState) {
    console.log(`[GitHub] 发布 ${tag}`);
    await run([
      "gh",
      "release",
      "edit",
      tag,
      "--repo",
      githubRepository,
      "--draft=false",
    ]);
  }

  console.log(`[发布完成] ${publicUrl}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[发布失败] ${message}`);
  console.error("若已创建 GitHub 草稿，修复问题后可直接重新运行同一命令续发。");
  process.exit(1);
});

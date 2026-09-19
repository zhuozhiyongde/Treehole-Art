# Treehole-Art 发版说明

本项目的发布链路沿用 `../PKU-Art` 的 CDN 方案，但实现为 Bun 脚本：多吉云永久密钥只用于换取短期 S3 凭据，构建产物通过腾讯 COS 的 S3 兼容接口上传，随后调用多吉云 API 刷新 CDN。永久密钥不会写进用户脚本。

## 首次配置

1. 安装依赖，并准备本地环境文件：

    ```bash
    bun install
    cp .env.example .env
    ```

2. 在 `.env` 中填写 `DOGECLOUD_ACCESS_KEY` 和 `DOGECLOUD_SECRET_KEY`。它们就是 `../PKU-Art/.env` 中同名的两项；因为两个项目使用同一账号和存储桶，可以复用其值。`.env` 已被 Git 忽略，不要把真实密钥提交到仓库。

3. GitHub Release 默认使用 [GitHub CLI](https://cli.github.com/) 的登录状态：

    ```bash
    gh auth login
    ```

    也可以在 `.env` 中填写具有仓库写权限的 `GITHUB_TOKEN`。脚本会将它作为 `GH_TOKEN` 传给 GitHub CLI。

## 每次发版

版本号的唯一来源是 `package.json`；Vite 会把它自动写入用户脚本的 `@version`。完整发布成功后，脚本会像 `../PKU-Art/update-cdn.py` 一样自动把补丁版本加一，例如从 `1.1.0` 推进到 `1.1.1`。如果下一版需要升级次版本或主版本，直接手动修改 `package.json` 即可。

发版时：

1. 运行 `bun run release`。如果 `CHANGELOG.md` 不存在，或没有当前版本的条目，脚本会在文件顶部生成 `## [x.y.z] - YYYY-MM-DD` 草稿并结束。
2. 补充草稿中的发布说明后重新运行 `bun run release`。最新一条 changelog 的版本必须与 `package.json` 一致，该条目会成为 GitHub Release 说明。
3. 正式发布前，脚本会确认同版本尚未正式发布，再自动暂存 `CHANGELOG.md`，并执行 `git commit -S -m "👷 ci: Vx.y.z"`。因此，运行命令前已经暂存的改动会进入同一个 GPG 签名提交；除 `CHANGELOG.md` 外的未暂存改动不会被加入。
4. 发布脚本不要求工作区干净，也不要求当前提交已推送。已有草稿 Release 时会继续发布；`--dry-run` 和 `--cdn-only` 不会创建发布提交。
5. 如需先演练测试和构建：

    ```bash
    bun run release -- --dry-run
    ```

6. 正式发布：

    ```bash
    bun run release
    ```

正式发布依次完成以下操作：

1. 为 changelog 和已有暂存改动创建 GPG 签名提交。
2. 运行全部测试并构建发布产物。
3. 校验产物中的 `@version`、`@downloadURL` 和 `@updateURL`。
4. 创建或更新 `v<版本号>` GitHub Release 草稿，并上传公开发布附件。
5. 将发布产物上传到配置的 CDN。
6. 刷新 `https://cdn.arthals.ink/release/` 目录的 CDN 缓存。
7. 将 GitHub Release 从草稿发布为正式版本。
8. 将 `package.json` 的补丁版本加一，作为下一次发布的版本。

如 CDN 阶段失败，GitHub Release 会留在草稿状态；修复网络或配置后重新运行 `bun run release` 即可续发。若只需要重新覆盖 CDN 文件，可运行：

```bash
bun run release -- --cdn-only
```

`--cdn-only` 仍会重新测试、构建、校验并上传 CDN 产物，但不会检查或创建 GitHub Release，也不会推进版本号。

## 可配置项

复制 `.env.example` 创建 `.env`，再在本地填写 CDN 配置：

- `CDN_BUCKET`：COS 存储桶名称。
- `CDN_ENDPOINT` / `CDN_REGION`：S3 兼容端点与地域。
- `CDN_OBJECT_KEY`：对象存储中的目标路径。
- `CDN_PUBLIC_URL`：用户安装和自动更新使用的公开地址。
- `CDN_REFRESH_URL`：发布后提交给多吉云刷新的目录 URL，必须以 `/` 结尾，默认为 `https://cdn.arthals.ink/release/`。
- `GITHUB_REPOSITORY`：GitHub 仓库的 `owner/name`。

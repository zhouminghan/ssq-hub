# GitHub 仓库信息核验

核验日期：2026-11-15

## 当前远程状态

通过 GitHub CLI 和公开 HTTP 请求核验：

```json
{
  "name_with_owner": "zhouminghan/ssq-hub",
  "description": "A modern Double Color Ball historical data analysis and visualization platform with automated data pipelines, statistical insights, and responsive charts.",
  "homepage": "https://zhouminghan.github.io/ssq-hub/",
  "topics": [
    "lottery",
    "ssq",
    "data-analysis",
    "data-visualization",
    "python",
    "typescript",
    "github-pages"
  ],
  "default_branch": "main",
  "visibility": "PUBLIC",
  "license_api_value": null
}
```

直接链接：

- 仓库：<https://github.com/zhouminghan/ssq-hub>
- Pages：<https://zhouminghan.github.io/ssq-hub/>
- Issues：<https://github.com/zhouminghan/ssq-hub/issues>
- Actions：<https://github.com/zhouminghan/ssq-hub/actions>

仓库主页和 Pages 地址均返回 HTTP 200。GitHub About 的描述、Homepage 和 Topics 已配置完成。

## 许可证状态

本地仓库已经包含 [MIT License](../../LICENSE)，但当前 GitHub `licenseInfo` 仍为 `null`。原因是包含 `LICENSE` 的重构分支尚未推送到默认分支；GitHub 只有在默认分支获得该文件后才能完成许可证识别。

## Pages 状态

Pages 地址可以访问，但当前正式页面仍是部署前的旧版产品。原因是：

- `origin/main` 仍停留在旧版本。
- 本地 `codex/product-rebuild` 分支尚未获得推送和发布授权。
- 重构版 Actions 与 Pages 结果不能在推送前被声称为已通过。

## 认证状态

以下命令已使用 macOS 钥匙串中的 GitHub CLI 凭据成功执行：

```bash
env -u GITHUB_PERSONAL_ACCESS_TOKEN \
  -u GH_TOKEN \
  -u GITHUB_TOKEN \
  gh repo view zhouminghan/ssq-hub
```

该命令避开了失效的环境变量，直接使用 `gh` 自身保存的有效认证。

## 当前分支状态

- 本地分支：`codex/product-rebuild`
- 远程同名分支：存在，但落后于本地。
- 默认分支：`main`
- 推送、合并和正式 Pages 发布仍属于需要明确授权的远程操作。

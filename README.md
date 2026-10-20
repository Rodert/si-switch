# Si Switch

Si Switch 是一个本地优先的 AI 编程工具 API 配置与切换管理器。V1.0 先覆盖 Codex 和 Claude Code，目标是让多套 API 配置可以被清晰保存、搜索、测试和一键切换。

## 当前骨架

- Tauri 2 + React + TypeScript + Vite 桌面应用
- Industrial 风格工作台：深色背景、等宽字体、1px 结构线和酸性黄绿信号色
- Codex / Claude Code 独立配置列表，支持新增、编辑、复制入口、删除保护、搜索、排序和当前配置切换
- 服务商管理、配置导入、使用说明和设置页面
- 内置离线使用说明，左侧导航和顶部工具栏均提供固定入口，并随所有平台安装包一同发布
- 配置编辑抽屉：服务商、Base URL、API Key 显示隐藏、模型、连接测试入口
- 浏览器预览模式使用 localStorage；Tauri 命令边界已预留给 SQLite、系统凭据、配置文件写入和本地代理

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

桌面开发（需要本机已安装 Tauri 系统依赖）：

```bash
npm run tauri dev
```

## 发布包

各平台的原生安装包由 Tauri 生成，ZIP 便携包由仓库脚本压缩已构建产物。需要在对应操作系统上执行打包命令，或在 CI 中使用对应的 runner。

| 平台 | 发布格式 | 命令 |
| --- | --- | --- |
| macOS | `.dmg` 安装镜像、`.zip` 便携包 | `npm run bundle:mac` |
| Windows | `.msi` 安装包、`.zip` 便携包 | `npm run bundle:windows` |
| Linux | `.AppImage`、`.deb`、`.rpm` | `npm run bundle:linux` |

对应的 Tauri 平台配置位于 `src-tauri/tauri.macos.conf.json`、`src-tauri/tauri.windows.conf.json` 和 `src-tauri/tauri.linux.conf.json`。macOS ZIP 在 macOS 上使用 `ditto` 保留应用包的资源和权限，Windows 便携 ZIP 由 `scripts/package-zip.mjs` 生成到 `artifacts/`。

当前脚本打包本机架构；macOS 分别提供 Intel 和 Apple Silicon 包。Windows 的便携 ZIP 只包含可执行文件，无需运行安装器；目标机器需要可用的 WebView2 Runtime。便携指解压运行，应用数据仍遵循系统用户目录。Linux 目前构建 x64 包，运行依赖系统 WebKitGTK 等组件。

仓库提供 `.github/workflows/release.yml`：每次向任意分支推送提交，都会在 macOS（Intel / Apple Silicon）、Windows x64 和 Ubuntu x64 runner 上构建全部格式，并发布一个 GitHub 开发版 Release。无需手工修改版本或创建标签。

每次构建会生成自动递增版本 `0.1.<GitHub run number>`，并统一使用北京时间。Release 标题和安装包文件名同时包含版本、明确的年月日时间戳及提交信息，例如：`Si-Switch_v0.1.27_2026-10-20_12-05-CST_Windows_x64.msi`。

当前工作流未配置应用签名或 macOS 公证，正式分发前需要接入相应证书。Windows、Linux 包及 Intel Mac 包需要在对应系统上进一步验证安装与运行。

## 下载官网

`website/` 是独立的 GitHub Pages 下载页。页面会识别访问者的操作系统并优先打开对应下载选择，同时保留 macOS、Windows 和 Linux 的全部格式入口；下载地址会自动读取最新的开发版或正式版 GitHub Release。

推送到 `main` 后，`.github/workflows/pages.yml` 会部署该目录。仓库首次使用时，需要在 GitHub 的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。

## 更新策略

桌面应用启动时会检查 GitHub Releases，也可以通过顶部的「检查更新」按钮手动检查。发现新版本后，用户可以前往下载官网选择适合当前系统的安装包。

更新策略位于 `website/update-policy.json`，默认是非强制更新。`forcedVersions` 保存必须升级的**当前旧版本号**；把版本加入数组即转为强制更新，从数组移除即恢复非强制更新。例如：

```json
{
  "defaultUpdateType": "optional",
  "forcedVersions": ["0.1.12"]
}
```

强制更新弹窗没有关闭或稍后更新入口。策略读取失败时应用采用非强制的故障安全行为，避免网络或 Pages 故障导致所有用户无法进入应用。需要启用强制更新时，应同时填写清晰的 `forceUpdateMessage`，并确认最新安装包可以正常下载。

## 目录

```text
src/                    React 页面、领域类型和本地预览存储
src-tauri/src/lib.rs    Tauri 命令边界和应用状态
src-tauri/tauri.conf.json
```

下一步可以沿着四条主线继续实现：SQLite 配置仓库、Keychain / Windows Credential Manager 密钥存储、Codex 与 Claude Code 文件适配器、本地 HTTP 代理服务。

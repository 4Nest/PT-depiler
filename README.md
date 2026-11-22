<p align="center">
  <img alt="PT-depiler-Lite Logo" width="88" src="./public/icons/logo/128.png?raw=true" />
</p>

<h1 align="center">PT-depiler-Lite</h1>

<p align="center">
  基于 <b>Manifest V3</b> 与 <b>shadcn-vue (Reka UI + Tailwind CSS v4)</b> 完全重构的轻量现代 PT / BT 站点效率扩展
</p>

<p align="center">
  <a href="https://github.com/4Nest/PT-depiler/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/4Nest/PT-depiler?style=flat-square&logo=github" /></a>
  <a href="https://github.com/4Nest/PT-depiler/actions"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/4Nest/PT-depiler/action_build.yml?branch=master&style=flat-square&logo=githubactions" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Android-10b981?style=flat-square" />
</p>

---

## 项目简介

**PT-depiler-Lite** 基于 [pt-plugins/PT-depiler](https://github.com/pt-plugins/PT-depiler) 站点解析引擎深度精简与重构，移除冗余低频模块与重型 UI 组件库，采用 **Vue 3 + shadcn-vue (Reka UI) + Tailwind CSS v4 + Lucide Icons** 全面重写管理后台与网页注入组件，兼顾桌面端高密度信息效率与移动端触控体验。

## 核心特性

- **现代轻量工作台**：可折叠侧边导航、支持 `⌘K` / `Ctrl+K` 呼出的全局多方案/单站 Command 搜索舱、原生亮/暗色主题无闪烁切换与 Sonner 通知。
- **个人数据与可视化**：Bento KPI 汇总指标卡（总上传/下载、综合分享率、保种体积、时魔收益、站点健康度与登录失效预警）、等宽数字对齐表格、等级升级进度浮层、隐私打码模式、ECharts 增量统计图表与高清时间轴海报导出。
- **多站并发聚合搜种**：支持 418+ 私站与公网 BT 站并发检索、实时队列状态监控、站点胶囊快筛、促销流量计费折算、彩色语义化优惠/字幕徽章及多维高级筛选器。
- **网页端无感直推与 Nyaa 行内集成**：基于 `closed` Shadow DOM 严格隔离宿主页样式，提供可自由拖拽的站点悬浮快捷菜单、拖拽链接投递、Nyaa 列表页/详情页原生行内「推送到下载器」按钮，以及支持**预设标签记忆 + 双列路径一键直推**的下载器投递面板。
- **MoviePilot 原生整合**：内置独立开关（`常规设置 -> MoviePilot`），在各大 PT 与动漫站详情页免跨域自动识别媒体信息、查询入库状态与直达播放、按季一键订阅及推送下载（兼容 MoviePilot V2 / V3，配置随扩展备份自动同步）。
- **桌面与移动端全量适配**：针对手机窄屏（`360px–430px`）自动将「我的数据」「聚合搜种」「站点/下载器管理」切换为无横向滚动的紧凑卡片列表，并将网页推送弹窗切换为贴底抽屉（Bottom Sheet），完整适配 Android Firefox 与移动端 Chromium 浏览器。
- **下载器与云端备份**：支持 qBittorrent、Transmission、Deluge、Aria2、Synology Download Station 等主流下载客户端；支持本地加密导出及 CookieCloud / WebDAV / S3 / Google Drive 等远程自动备份与恢复。

## 安装指南

前往 [Releases 页面](https://github.com/4Nest/PT-depiler/releases) 下载最新构建包：

### 1. 桌面端（Chrome / Edge / Brave / Firefox）

- **Chrome / Edge**：解压 `PT-Depiler-Lite-chrome.zip`，打开 `chrome://extensions`（或 `edge://extensions`），开启右上角「开发者模式」，点击「加载已解压的扩展程序」并选择解压目录。
- **Firefox**：在 [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/zh-CN/developers/addon/submit/distribution) 选择 _On your own_ 上传 `PT-Depiler-Lite-firefox.zip` 自动签名获取 `.xpi` 安装；或在 Firefox Developer Edition / Nightly 中关闭 `xpinstall.signatures.required` 后直接从文件安装。

### 2. 移动端（Android）

- **Firefox Nightly / IronFox（推荐）**：打开「设置 -> 关于 Firefox」连点顶部图标 5 次开启调试菜单，在 `about:config` 将 `xpinstall.signatures.required` 设为 `false`，返回「设置 -> 从文件安装附加组件」选择 `PT-Depiler-Lite-firefox.zip`（Firefox 正式版安装自签名 `.xpi` 即可免改 `about:config`）。
- **Mises / Quetta / 狐猴 (Lemur) / Edge Mobile**：打开扩展管理页并开启「开发者模式」，直接导入 `PT-Depiler-Lite-chrome.zip`。

## 源码开发与构建

环境要求：Node.js `>= 23.7.0`、pnpm `>= 12.0.0`。

```bash
git clone https://github.com/4Nest/PT-depiler.git
cd PT-depiler
pnpm install

# 类型检查与站点定义静态校验
pnpm check

# 构建 Chrome / Edge 扩展（输出至 dist-chrome/）
pnpm build:dist

# 构建 Firefox / Android Firefox 扩展（输出至 dist-firefox/）
pnpm build:dist-firefox
```

## 致谢与许可证

本项目遵循 [MIT License](./LICENSE) 开源。核心站点解析与下载器协议适配源自上游项目 [pt-plugins/PT-depiler](https://github.com/pt-plugins/PT-depiler) 与 [PT-Plugin-Plus](https://github.com/pt-plugins/PT-Plugin-Plus)。

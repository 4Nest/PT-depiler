<p align="center">
  <img alt="Logo" width="96" src="./public/icons/logo/128.png?raw=true">
</p>

<h2 align="center">PT-depiler (4Nest Fork)</h2>

<p align="center">
  基于 Manifest V3 的现代 PT 站点效率浏览器扩展（精简重构版）
</p>

### 简介

本仓库基于 [pt-plugins/PT-depiler](https://github.com/pt-plugins/PT-depiler) 维护与深度精简重构，聚焦核心 PT 站点管理、多站聚合搜索、下载器推送与数据备份/统计体验：

- **我的数据**：全局 KPI 指标卡片（总上传/下载/分享率、做种体积、时魔、站点健康度）、站点个人数据管理、历史记录与趋势统计。
- **聚合搜索**：多站点/自定义方案并发聚合搜索、分组与筛选、种子详情与一键推送下载器。
- **搜索快照**：保存和回放聚合搜索结果快照。
- **站点悬浮侧边栏**：轻量高对比度胶囊操作面板，支持列表页批量解析/高级列表、详情页快捷操作及拖拽链接推送。
- **配置与备份**：站点配置、下载器管理（qBittorrent / Transmission / Deluge / Aria2 等）、搜索方案、本地加密导出与 WebDAV / Gist 等远程备份恢复。

### 源码构建

环境要求：Node.js `>= 23.7.0`、pnpm `v12`（见 `package.json` 的 `packageManager` 字段）。

```bash
git clone https://github.com/4Nest/PT-depiler.git
cd PT-depiler
pnpm install

# 类型与静态资源校验
pnpm check

# 构建 Chrome / Edge 扩展 (产物位于 dist-chrome)
pnpm build:dist

# 构建 Firefox 扩展 (产物位于 dist-firefox)
pnpm build:dist-firefox
```

### 许可证

本项目遵循 [MIT License](./LICENSE)。上游原项目版权归属 [pt-plugins](https://github.com/pt-plugins)。

<p align="center">
  <img alt="Logo" width="88" src="./public/icons/logo/128.png?raw=true">
</p>

<h2 align="center">PT Depiler Lite</h2>

<p align="center">
  基于 Manifest V3 与 <b>shadcn-vue (Reka UI + Tailwind CSS v4)</b> 完全重做的现代 PT 站点效率扩展
</p>

### 特性概览

本仓库基于 [pt-plugins/PT-depiler](https://github.com/pt-plugins/PT-depiler) 核心站点引擎深度裁剪，并使用 **shadcn-vue + Tailwind CSS v4 + Lucide Icons** 彻底重做全站管理台与站点内悬浮组件，移除冗余低频模块与重型 UI 框架，专注高频核心体验：

- **现代工作台壳层**：可折叠 shadcn Sidebar、支持 `⌘K` 快捷键与单站/多方案切换的全局 Command 搜索舱、原生亮/暗主题无闪烁切换与 Sonner Toast 通知。
- **我的数据**：Bento KPI 汇总指标卡（总上传/下载/综合分享率、保种规模、时魔产出、站点健康度与快捷过滤）、高密度等宽对齐数据表、升级进度浮层、ECharts 多维统计图与 Konva 时间轴海报。
- **聚合搜索**：多站点并发搜索与实时状态监控、站点胶囊快捷筛选与促销计费折算统计、高对比双行种子卡片列、多维高级筛选生成器与一键直推下载客户端。
- **站点悬浮快捷舱与分组直推**：基于 Shadow DOM 样式隔离的高对比悬浮菜单，支持详情页/列表页批量勾选投递、拖拽链接直推，以及按下载器聚合的「标签记忆 + 双列路径」一键直推面板。
- **MoviePilot 原生整合**：内置独立开关（`常规设置 -> MoviePilot`），支持各大 PT 与动漫站详情页免跨域自动识别媒体信息、入库状态与播放直达、按季一键订阅及推送下载（兼容 MoviePilot V2/V3，配置随扩展备份自动同步）。
- **管理与云端备份**：418+ 站点定义与一键探测导入、多下载器管理（qBittorrent / Transmission / Deluge / Aria2 等）、可视化搜索方案构建器、本地加密备份与 CookieCloud / WebDAV / S3 / GDrive 等远程备份恢复。

### 源码构建

环境要求：Node.js `>= 23.7.0`、pnpm `v12`。

```bash
git clone https://github.com/4Nest/PT-depiler.git
cd PT-depiler
pnpm install

# 类型与站点定义静态校验
pnpm check

# 构建 Chrome / Edge 扩展 (产物位于 dist-chrome)
pnpm build:dist

# 构建 Firefox 扩展 (产物位于 dist-firefox)
pnpm build:dist-firefox
```

### 许可证

本项目遵循 [MIT License](./LICENSE)。上游站点解析引擎版权归属 [pt-plugins](https://github.com/pt-plugins)。

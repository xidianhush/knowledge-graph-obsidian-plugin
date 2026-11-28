# Knowledge Map 知识地图

[English](README.md) · [简体中文](README.zh-CN.md)

**用一张可以亲手整理的地图，探索笔记的层级与联系。** 文件夹、笔记和标题形成嵌套的圆，双链连接相关知识。

![知识地图总览](docs/assets/knowledge-map-overview.png?v=20261121)

## 安装后，开始第一张地图

1. 在 Obsidian「设置 → 第三方插件 → 浏览」搜索 **Knowledge Map**，安装并启用。也可打开[目录页](https://community.obsidian.md/plugins/knowledge-graph-smoke)。
2. 在插件设置中选择要纳入的文件夹。
3. 点击左侧插件图标，或在命令面板运行「**从当前库构建知识图谱**」（英文界面为 **Build knowledge graph from current vault**）。可以拖动画布、缩放层级，并预览笔记；界面支持中文和英文，默认跟随应用语言。

手动安装时，将 [Release](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/releases) 中的 main.js、manifest.json 和 styles.css 放入本库 .obsidian/plugins/knowledge-graph-smoke/。升级、备份和回退见[安装指南](docs/INSTALL.md)。

下文的一键同步流程对应 **1.0.0**。旧版本的界面可能不同，请安装同一版本的三个运行文件，详见[版本与安装说明](docs/INSTALL.md#1-版本与兼容)。

## 从全局探索到标题

嵌套圆表示知识属于哪里，颜色跟随顶层文件夹，圆的大小反映其下结构。桌面拖动画布平移，滚轮缩放层级；iPad单指平移、双指缩放，也可点击 − / +。点「重置视图」回到当前层级默认位置。

![缩放探索](docs/assets/knowledge-map-zoom.gif?v=20261121)

桌面按住 Ctrl 并悬停预览，点击圆固定预览；iPad长按笔记或标题，或选中后点「预览」。点击关闭按钮退出；桌面也可按 Esc。

![预览笔记](docs/assets/knowledge-map-preview.gif?v=20261121)

## 顺着联系思考

连线连接笔记和标题。圆点标记来源，箭头标记目标；虚线表示并列/对比关系。选中一个圆可高亮相关联系，灰色点线显示它的祖先路径。可见连线受缩放、过滤和绘制上限影响。

![知识之间的联系](docs/assets/knowledge-map-links.png?v=20261121)

## 把重点放在合适的位置

点 ✥「调整布局」，拖动圆的位置，再点一次结束。工具栏支持撤销、重做和重置。桌面支持组拖动；触屏一次移动一个元素。布局独立于笔记保存，结构变化后会尽可能协调恢复；不兼容的组回退到自动布局。

![调整布局](docs/assets/knowledge-map-layout.gif?v=20261127-avoidance)

## 可选：电脑与 iPad 共享布局

先让两台设备具有相同的笔记，并把插件设置中的「**包含范围**」「**排除范围**」和「**排除笔记**」设为一致。再在两台设备的插件设置中各开启一次布局同步；默认共享图谱会自动准备和连接，无需手动创建或查找 ID。

用同步工具传输笔记和 **`Knowledge Map Sync` 文件夹**。同步开启后的普通兼容修改会自动排队；文件到达另一端并通过校验后，图谱会自动更新。不同已有布局、多份候选、冲突和关闭期间保存的草稿，仍需要选择或审阅。关闭同步保留本机工作。

已验证链路为 **Windows ↔ iPadOS + 坚果云官方 Nutstore Sync 插件**。设置、视角和界面状态留在本机。本机保存、写入共享目录与另一台设备应用是不同阶段。配置、备份和恢复见[同步指南](docs/SYNC_GUIDE.md)。

## 平台和限制

- 桌面声明的最低 Obsidian 版本为 1.6.7；近期 Windows 测试使用 Obsidian 1.15.1。
- iPad 测试设备为 iPad Pro 2022 / iPadOS 26.5.2，近期同步测试使用 Obsidian 1.15.1（404）及 Nutstore Sync 1.6.2。不据此宣称所有设备或版本已验证。演示素材展示桌面操作。
- iPhone 未验证，Android 单独排期。iPad 最低系统版本、客观帧率和内存上限尚未确定。
- 每组最多128个同级元素、一次影响最多5000节点；会话撤销最多50步，结构变化或插件重载会清空。
- 图谱画布保持深色。大同步历史可能回放较慢；第三方限流及原 iPad 试验中的未归因异常仍是已披露限制，详见[同步指南](docs/SYNC_GUIDE.md#protection-limits-and-disclosed-limitations)。

## 数据、隐私和帮助

建图在本机完成，插件不编辑笔记正文，也不直接上传。共享布局包含相对路径、标题结构和坐标，第三方工具可能将它们上传到其服务。加入后还存在本机身份和私有日志；data.json并非完整同步备份。请导出完整恢复包，原位保留并另复制库外。

[安装与回退](docs/INSTALL.md) · [数据边界](docs/DATA_SAFETY.md) · [问题反馈](https://github.com/xidianhush/knowledge-graph-obsidian-plugin/issues) · [构建与测试](DEVELOPMENT.md) · [参与开发](CONTRIBUTING.md) · [MIT许可](LICENSE)

开发者入口：1.0.0 保留 `dddf14a` 的一键同步体验和已发布恢复修复，工作区与当前任务见[工作区规则](docs/WORKSPACE.md)和 [TODO](TODO.md)。

> 当前活动分支与三条基线见[工作区规则](docs/WORKSPACE.md)。先运行npm run workspace:check。当前源码为dddf14a一键同步+已发布恢复修复的整合候选，0.0.17版本标签不表示与已发布资产相同。旧分步引导不参与构建，详细新证据见基线收敛结果。

# 开发与验证

本地发布记录为0.0.17；本工作区为新整合开发候选，尚未发布/体验验收。当前任务见[TODO](TODO.md)，本轮证据见[执行记录](docs/QUALITY_IMPLEMENTATION_2026-11-24.md)。历史开发记录见[归档](docs/archive/DEVELOPMENT_before_quality_2026-11-24.md)，不能当本轮重新通过。

## 从干净源码开始

开发工具使用Node 22.13+的22 LTS或Node 24+，npm及Python（仅浏览器/原生专项）；运行插件不需要Node/npm。先读AGENTS、TODO和README。

```sh
npm ci
npm run check
```

check依次运行ESLint、Prettier检查、基线契约模块JSDoc类型检查、默认构建与合成契约、交付完整性/真实打包负例、输入边界及有限防漏检查。无Obsidian、网络服务、个人笔记或私有快照前提；npm ci需要开发依赖或缓存。CI在PR/主分支运行同一检查，远端运行记录与本地结果分别记载。

静态规范只覆盖本轮新增/整理模块，精确范围见package scripts与eslint配置；不是全仓lint/typecheck已通过。旧源码渐进纳入。格式与逻辑分别审阅。

## 构建和交付

```sh
npm run build
npm run test:release
node scripts/package.mjs --out .local/release/review-candidate
node scripts/quality_clean_check.mjs
```

正式三个运行文件是dist/main.js、dist/manifest.json、dist/styles.css。dist还有测试模块，不能整包交付。默认构建不会复制私有快照，并只清理已知的旧smoke-payload副本；存在其他私有产物时打包拒绝。输出目录存在未知文件也拒绝，不自动删除它们。私有快照测试须显式指定隔离测试输入与输出，不再依赖build复制。

clean_check把明确的当前候选源码/脚本/夹具复制到新临时目录，在没有.git、node_modules和私有状态时构建、跑默认契约并打包。它验证候选导出，不代表尚未提交源码已出现在HEAD/公开仓库。仅三个运行文件上传，摘要与说明另附发布正文。

## 根据改动选专项

- 提示/控件：默认i18n与状态契约，加npm run test:sync-settings-browser（Python Playwright及Chrome，独立合成页面/IndexedDB，非真实Obsidian）。
- 保存/身份/恢复：package中的test:sync-*-disk及受影响的故障/中断脚本；使用临时合成目录，不编辑日常库。
- 图谱/宿主/触屏：默认契约加受影响的浏览器/原生合成场景；像素、真实Markdown、Windows/iPad与第三方传输不能互相替代。
- 性能：固定样本、同一构建/设备、明确起止点；报告原始数据与局限，不事后挑数值。

旧Python脚本可能有本机路径/端口约定，先读再运行；Playwright/Pillow环境未锁定，不宣称跨系统即装即跑。旧A/B依赖真实历史包，缺失时报告未执行。不得拿新包冒充旧版。

## 维护与发布

流程见[贡献指南](CONTRIBUTING.md)，模块见[架构](docs/ARCHITECTURE.md)，数据见[安全边界](docs/DATA_SAFETY.md)。发布CI接受无前缀X.Y.Z正式版本，先运行相同门禁；手动dispatch仍仅验证，不创建Release。已有Release拒绝覆盖。正式发布前另验最终设备、备份/升级/回退与用户体验，源码及字节冻结后按明确授权推tag。

原生设备验证先核对实际库、安装三文件摘要和运行版本。私有报告/截图/配置留在.local；公开仅合成夹具与脱敏结论。产品验收由用户确认，未执行检查不记通过。

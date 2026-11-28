# Knowledge Map 同步体验候选（SYNC-UX）验收指南 / Sync UX Candidate Acceptance Guide

> 这是一个**同步体验候选**（Knowledge Map Sync UX Candidate），不是正式发布。它保留当前 manifest 版本号，不占用正式版本号；未 commit/push、未移动正式 tag、未发布 Release、未升级日常库。请在**独立测试库**验收，不要用于日常库。
>
> This is a **sync ease-of-use candidate**, not a release. It keeps the current manifest version and does not occupy a formal release version. No commit/push, tag move, Release, or daily-vault upgrade. Accept it in **independent test vaults**, not your daily vault.

## 0. 这个候选改变了什么 / What changed

首次使用只需在每台设备点一次“开启布局同步”。插件自动准备默认布局、写入可传输的初始化资料、发现并连接同一共享图谱、保存和接收修改。**不再要求先手动移动一个圆、新建/查找/核对共享 ID、或手动确认空布局。** 已有布局、冲突、关闭期间草稿仍按现有保护处理，需要决定时界面会解释原因并保护双方工作。操作历史、私有账本、布局校验与恢复机制全部保留。

First use needs only one tap of “Enable layout sync” per device. The plugin prepares the default layout, writes transferable initialization data, discovers and connects the same shared graph, and saves/receives changes. **No prior drag, no create/find/verify shared ID, no manual empty-layout confirmation.** Existing layouts, conflicts and off-period drafts keep their existing protections.

## 1. 准备 / Prepare

- 两台设备：Windows PC 与 iPad（验证范围）。两个**独立全新测试库**，图谱包含相同笔记，插件设置中的“包含范围”“排除范围”和“排除笔记”一致（本候选预置 `Synthetic/**` 两篇合成笔记）。
- 一个外部同步工具（如坚果云），负责在两端之间传输库内的 **`Knowledge Map Sync`** 文件夹。本候选不控制同步队列、不加云账号设置。
- 远端同步目录：`{{REMOTE}}`（仅用于本次独立测试，勿与日常库远端混用）。
- 候选已预置在提供的 pristine 库中（插件 ID `knowledge-map-sync-ux`，名称 Knowledge Map Sync UX Candidate）。若手动安装：仅替换 `main.js`/`manifest.json`/`styles.css` 三个运行文件到测试库的 `.obsidian/plugins/knowledge-map-sync-ux/`，保留该库 `data.json` 与 App 私有状态。

Two devices (Windows PC + iPad), two independent fresh test vaults with the same notes and matching Include scope, Exclude scope and Excluded notes settings (`Synthetic/**`). An external sync tool (e.g. Nutstore) transfers the in-vault **`Knowledge Map Sync`** folder. Remote folder: `{{REMOTE}}`. The candidate is preinstalled in the provided pristine vaults.

## 2. 主验收：两台全新设备，无需预先拖动 / Headline: two fresh devices, no prior drag

1. 两端安装并启用候选插件，打开/构建当前库图谱（命令面板 Open graph）。
2. 两端分别进入 设置 → Knowledge Map → **布局同步**，点一次开关“开启布局同步”。**无需先拖动任何元素。**
3. 插件自动准备固定默认图谱与初始化资料。状态显示：“本机已准备好。请用同步工具传输 Knowledge Map Sync 文件夹。”
4. 让同步工具把 `Knowledge Map Sync` 文件夹经 `{{REMOTE}}` 在两端之间传输完成。
5. 文件到达后，两端自动连接并加入**同一默认图谱**，状态进入正常使用。**无需选择/核对 ID，无需手动确认空布局。**
6. 在 PC 移动一个元素并结束调整；传输完成后 iPad 对应图谱显示相同位置。再在 iPad 移动 → PC 接收。两端重开后布局保持。

Enable the plugin and open the graph on both. Tap “Enable layout sync” once on each (no drag). The plugin prepares the default graph; status asks you to let the sync tool transfer `Knowledge Map Sync`. After transfer both devices auto-connect and join the same default graph. Drag on PC → iPad receives; drag on iPad → PC receives; reopen preserves.

**回报 / Report back:** 两端状态截图、当前共享 ID（详情中）、是否无需拖动/选 ID 即双向同步、重开是否保持、任何错误原因文案。

## 3. 已有布局与冲突（可选）/ Existing layouts & conflict (optional)

- **本机独有 / 共享独有 / 相同：** 开启授权下自动备份+校验后采用，不重复发布。可先在 PC 拖动再开启 iPad 验证“共享独有→自动采用”。
- **两边不同：** 展示本机与共享预览，由你决定；不直接覆盖任一方。
- **同时编辑同组：** 双方都保留，提示冲突需要你来决定（普通区出现“处理冲突”）。
- **旧布局校验问题：** 沿用“当前可用布局”审阅与归档保护，不自动丢弃。

## 4. 关闭再开启 / Off then on

关闭开关：立即停止新的共享读写，本地工作保留（“同步已关闭，本地工作保留。”）。关闭期间保存的草稿，再开启后**仍需审阅发布**，不会自动发布。

## 5. 高级与恢复 / Advanced & recovery

普通区默认折叠“高级与恢复”，保留：检查共享布局、新建/切换其他图谱（仍随机 ID）、共享 ID 与诊断、完整恢复备份、兼容导出、轮换、异常恢复。冲突/待发布草稿出现时相关入口提升到普通区。

## 6. 边界与未执行项 / Boundaries & not-yet-executed

- 本候选的合成/磁盘/浏览器测试已由开发侧本轮实际运行通过（见 `docs/SYNC_UX_EASY_SETUP_RESULT.md`）；这些是**本地文件模拟与自有浏览器**，不代表原生 Obsidian 或真实跨端传输。
- **Windows Obsidian 两独立库原生测试**与 **Windows ↔ iPadOS + 坚果云真实跨端测试**由你在本节步骤中执行，开发侧未执行，不继承历史通过数字。
- 不宣称任意同步工具均已验证；验证范围限 Windows ↔ iPadOS + 坚果云。
- 旧客户端不支持空图谱初始化；有真实布局操作后仍可发现相同历史。

## 7. 安全 / Safety

仅用独立测试库；不升级日常库；不 commit/push、不移正式 tag、不发布 Release（除非另获明确授权）。私有笔记/截图/配置不加入公开交付包。
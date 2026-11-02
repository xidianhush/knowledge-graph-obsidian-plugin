# 47-A2 授权副本连续压力与结构变更验证（0.0.11）

日期：2026-11-01 ～ 2026-11-02
版本：0.0.11（`main.js` sha256 `205b1bd0383a223f92aef6f09e36327882bd081f3c707bab725fb47b9d3bf049`，325,976 B）
环境：Windows，Obsidian 1.14.5（安装程序 1.6.7）/ Electron 30.1.2 / Chrome 124.0.6367.243，深色主题，单库单窗口，CDP 真实鼠标/键盘输入。
测试库：`.local/native/vault-real`，由用户授权副本 `real-vault-trial` 复制而来（95 篇 Markdown，3310 节点 / 3406 边）；私有笔记只读，未改动原文；合成笔记只增不改私有内容。
证据：`.local/evidence/continuous-real/{continuous-real.jsonl,result.json,structural-v2.json}`、`p2c-*`/`p1-*` 截图见 `.local/native/evidence/shots/`。
驱动脚本：`.local/native/lead_real_30min.py`、`lead_real_structural_v2.py`（CDP 基础库 `cdp_lib.py` / `lead_layout_native4.py`）。

## 1. 30 分钟连续压力（授权副本）

命令：`DURATION_SECONDS=1800`；结果文件 `result.json` verdict `pass`。

| 指标 | 结果 |
| --- | --- |
| 时长 / 轮次 | 1802.1 s / 384 轮 |
| 失败 / 渲染异常 | 0 / 0 |
| 每轮操作 | 重建、加标题、改标题、改正文、笔记改名、目录改名、隐藏→恢复、快速重建、预览开→关、泄漏检查、拖动保存 |
| 重建 | 809 次，p50 0.400 s / p95 0.410 s / max 0.890 s |
| 预览 | 38/38 打开成功（中位 1.0 s），关闭无残留 |
| 隐藏→恢复 | 38/38（中位 1.69 s） |
| 快速三连重建 | 38/38 无错误（0.40 s 为轮询粒度，不作为取消竞态证据） |
| 拖动 | 38 次：9 次“布局已保存”、29 次“布局未改变”（拖动同一位置幂等，符合预期） |
| 磁盘 revision | 单调增长至 68；布局体积 jsonl 采样稳定后不再增长 |
| 帧率 | p50 65.1 fps / p95 67.3 / min 59.7 |
| 渲染进程堆 | 51–170 MB 锯齿波动，p50 87.5 MB，末值 123.2 MB，无单调攀升（采样为渲染进程 `performance.memory`） |
| 最终磁盘 | `schemaVersion 3`、`revision 68`、groups 3、structures 2、布局 JSON 90,459 B、整份 data.json 136,283 B |
| 恢复 | 压力结束恢复合成笔记原文；`untouchedPrivateNotes=true`；重建 3310 节点 |
| 私有笔记完整性 | 源副本 95 个 md 与测试库对应文件 sha256 逐一相同（副本仅多合成笔记） |

> 说明：本实例插件 `settings.include` 只含 `Science and Tech/**` 与 `Literature History Philosophy/**`，`压力测试/` 不在范围内，因此压力轮里的“改标题/改名”对图谱是 no-op（nodes 恒 3310）——这部分只作为“其它笔记键不受影响”的负向对照；结构/改名的正向验证见第 2 节。

## 2. 结构与改名正向验证（include 范围内合成笔记）

合成笔记：`Literature History Philosophy/布局验证/样本.md`（可随时删除，不影响私有笔记）。
证据：`structural-v2.json`（steps 1–9，errors 空）。

| 步骤 | 操作 | 结果 |
| --- | --- | --- |
| 1 | 重建基线 | 96 篇 / 3315 节点 / 3411 边；store rev 76 |
| 2 | 选中标题 `样本/分支一` | 通过节点投影 + hitTest 命中该节点 |
| 3 | 真实鼠标拖动并保存 | rev 76→77，HUD“布局已保存”，groups 键 `["heading","…/布局验证/样本.md","#样本"]`；重建后该节点坐标与拖动后一致（≤1e-6） |
| 4 | 追加标题（结构变化） | 96 篇 / 3316 节点；rev 78；message“布局未改变”；原拖动节点坐标 delta (dx 2.688, dy -0.834)，相对半径 0.967（r=2.911）——属结构增删后的局部修复位移，需在体验中确认可接受 |
| 5 | 笔记改名 样本.md → 样本-改.md | rev 79；groups 键迁移为 `…/布局验证/样本-改.md`，oldKeyGone=true；structures 键同步迁移；message“图谱结构已变化；撤销记录已清空” |
| 6 | 目录改名 布局验证 → 布局验证-改 | rev 80；groups 键迁移为 `…/布局验证-改/样本-改.md`，newKeyPresent=true；structures 键同步 |
| 7 | 改回原名（笔记 + 目录） | rev 82；groups 键恢复 `…/布局验证/样本.md`，originalKeyBack=true |
| 8 | 泄漏检查 | 布局磁盘 `diskLeak=false`、状态消息 `statusLeak=false`、store `storeLeak=false`；`nodesLeak=true` 仅来自 note 节点的 `excerpt` 字段（既有悬停预览交互，最多 220 字符、只在内存，不写入布局/日志/状态消息） |
| 9 | 删除合成目录 | 重建 3310 节点；store groups=[]；磁盘 `530 B`、groups/structures 均为空 |

结论：改名/目录重构后，布局记录的键能随宿主事件迁移、不丢节点、重建后对应关系正确；结构增删走局部修复、布局保留（含小幅位移）；删除后相关布局记录被清理，其余不受影响。

## 3. 隐私/泄漏口径

- 布局记录、状态消息、插件日志中未出现笔记正文（磁盘/状态/日志检查均 `false`；空白库首次使用检查同结论）。
- 图谱节点（内存）携带 note 的 220 字正文摘要，用于悬停/预览——这是 0.0.6 起的既有交互，不属于持久化泄漏；是否保留由产品决定（当前维持现状）。
- 空库首用（48-A1）验证：仅三个运行文件安装、空范围提示、建笔记后 11 节点、`LEAK-BLANK-MARKER` 未进入 data.json/状态/错误、设置持久化、卸载删除插件目录与 data.json → 证据 `.local/evidence/delivery-48a1/blank-vault.json`（verdict pass）。

## 4. 局限（不宣称超出范围）

- 单实例、单窗口、单显示器；未覆盖多显示器/多窗口并发拖动。
- 输入为 CDP 合成鼠标/键盘（已在原生窗口生效），非真人手速；帧率与堆来自渲染进程采样，非主进程级监控。
- 结构验证用的“改标题/改名”由 `app.vault.process`/`app.fileManager.renameFile` 触发，模拟宿主事件；未覆盖重命名冲突、外部同步工具并发改名等罕见路径。
- `include` 范围外的笔记不参与图谱，其改名不产生布局键迁移（符合当前设计）；真实库若调整 include/exclude，需要重新建图后才体现。
- 30 分钟连续压力不代表长期稳定性保证；长期资源边界仍在 46-A3 观察。

# U5-FB1 修复候选：保留原现场续验

2026-11-15。仅用于之前的 Knowledge Map Unified PC / Knowledge Map Unified iPad 两个合成测试库。版本显示仍是 0.0.15，插件仍为 Knowledge Map Sync Candidate（knowledge-map-sync-unified）；不是正式发布。

## 一：更新三个运行文件

1. 两端先暂停坚果云自动传输，暂时不拖动布局。继续使用原两端测试库和原远端，不新建连接、不重新导入。
2. 完全关闭 PC 和 iPad 上这两个测试库的 Obsidian 后再替换文件。
3. 更新包只有 knowledge-map-sync-unified/main.js、manifest.json、styles.css，以及本说明。将这三个文件分别复制到两端原测试库的 `.obsidian/plugins/knowledge-map-sync-unified/`，只替换这三个同名文件。不要替换整个 `.obsidian` 或插件文件夹，不覆盖 data.json，不清除 App 存储或卸载插件。
4. 重新打开两端原测试库，各建一个图谱，打开「设置 → Knowledge Map Sync Candidate → 图谱布局同步」。当前共享布局 ID 应仍为 `fb5e079e373ff735301f294f7b044c8d`；若不同或显示身份恢复/容量/损坏，请先导出报告并暂停，不新建连接。

### iPad 看不到 .obsidian 时

iPad 自带“文件”App 无法直接浏览该隐藏目录。Obsidian 官方列出的访问工具包括 Taio 和 Textastic，见 [配置目录说明](https://obsidian.md/help/Files%2Band%2Bfolders/Configuration%2Bfolder)。这不是同步失败，不需要重建库或改配置目录名。

先将更新ZIP保存到iPad并在“文件”App解压。关闭Obsidian后，使用Taio添加/打开外部文件夹，选择实际原测试库 `Knowledge Map Unified iPad`（不是新建一个同名副本）。在Taio的文件浏览器中查看 `.obsidian/plugins/knowledge-map-sync-unified/`，只复制/替换解压包里的 main.js、manifest.json、styles.css。若有“隐藏文件”过滤，关闭过滤/启用显示。保留data.json及其它文件，重开原库后再续验。

如果已经使用Textastic，可通过 Add External Folder 添加原测试库；进入上述目录，通过 + → Import → Import Files 选择解压包的三个文件，核对同名替换。Textastic官方说明：[外部文件夹](https://www.textasticapp.com/v10/manual/integration_other_apps/external_files_folders.html)、[导入复制文件](https://www.textasticapp.com/v10/manual/managing_files/creating_new_files.html)。应用入口文案随版本可能不同；若无法找到文件或复制入口，停在当前文件浏览器并回交截图，不改名/覆盖整个配置目录、不启用整份配置同步。本文为官方资料核对后的操作指引，尚未在用户iPad上实操验证。

## 二：在 PC 审阅当前待发布工作

1. PC 点击「审阅待发布布局」。这里展示的是你最后保存的本机草稿，包含第四部分后续拖动；不等同于第三部分最初那次布局。旧报告和本机原记录继续保留。
2. 当另一端修改已到达时，预览还会显示「当前共享布局」，说明先把本机工作保留为独立共享分支。先点取消，再导出「修复-取消-PC.json」；取消不应改变布局或增加共享记录。
3. 再次审阅，核对草稿和共享布局，点击预览内的「保留两边，继续审阅」（若无新到达修改，按钮为「确认」）。成功后导出「修复-保留-PC.json」。若提示共享文件已变化，请重新打开预览；不要反复点旧窗口。
4. 若提示两份分支已保存，PC 点击「审阅布局冲突」，应出现布局选择。先取消，再次打开、选择期望的布局并点最终确认。此时才决定最终布局，前一步只是在共享历史中保留本机分支。导出「修复-解决-PC.json」。
5. 若这里显示没有共享冲突或没有待发布布局，请先导出当时报告，说明此前是否执行过其它操作；不要为制造冲突再拖动。若出现容量、校验失败、等待文件/笔记或其它暂停，也先导出报告和截图。

## 三：传输、接收与最终重开

1. PC 手动坚果云同步 → iPad 手动同步 → PC 再同步；两端保持图谱可见，必要时点击「检查共享布局」。应显示所选局部布局，视角和缩放不要求相同。
2. 完全退出再重开两端 Obsidian，各建图、检查，导出「修复-最终-PC.json」「修复-最终-iPad.json」。不需要重做旧的首次导入和双向基线。
3. 回交上述5份 JSON，以及两端最终图谱/同步设置截图。反馈预览是否可辨认、取消是否不改变布局、两步确认是否清楚、最终局部布局是否一致。

本轮重点修复原阻塞现场；通过后再安排剩余体验验证。Windows 两个原生 profile 的本地文件交接不能替代这次 Nutstore/iPadOS 验收。不要发送同步服务配置或凭据。

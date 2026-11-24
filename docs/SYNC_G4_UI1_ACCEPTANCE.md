# G4-UI1 横条用户复验回执

后续更新（2026-11-17）：[UI2补图核对完成](SYNC_G4_UI2_INSPECTION.md)。PC打开图谱后view正确匹配原接受布局及上次iPad报告，25操作/sequence119未变，outcome转noop后状态推导saved。以下旧视图待核对已解除；空闲误暂停文案仍未修复。

2026-11-17。用户明确PC/iPad空消息时无横条、正常检查结果滚动可见、撤销后无残条，截图与回报相符。**UI1横条本场景验收完成**。另发现PC状态文案及本机视图投影待核对，不把显示验收扩大为本轮同步全流程通过。

2份原报告/3张截图按字节归档至 `.local/sync-016/g4/ui1-acceptance-20261117/`，保留源路径、大小与SHA-256。`verify.py` / `verification.json` 19项回执核验通过；未运行新的默认、浏览器、原生或坚果云测试，未改源码/版本/用户库或发布。

两报告build完整匹配UI1候选，PC本机main与styles摘要分别匹配a49a3d27…及29429890…。iPad未直接读取文件系统样式摘要，采用构建报告、截图和用户体验回报核验。两端均Obsidian1.15.1，mobile标记分别false/true，原安装身份及连接141c7955…保持。

每端完整accepted凭据与其FB5最终报告完全相同，仍25操作；跨端按ID集合/正文映射核对相同，groups/structures相同、无Fifth。跨端操作数组顺序和设备revision/fingerprint不强求相同。两端status=ready，error/saveError/pending/pendingSave/layoutDraft/selectionPending均为空，faulted/externalPending=false。既有接受记录保留，不推定当前两端图谱已经重新显示相同布局。

PC截图1正常显示“匹配2篇笔记，排除1篇（未读取正文）”，截图2及iPad截图3无空横条，符合本轮保留有文字sticky提示的契约。撤销和上下滚动体验依据用户明确回报。

## 另行记录的PC现状

PC outcome为held/publication-review-required，publication.paused=false且没有待发/草稿。iPad队列lastResult同为publication-review-required，但outcome=noop/receive。用生产deriveSyncStatus与报告映射重算，PC显示held，iPad显示saved；这解释当前不同文案，不能当作存在新的未发布布局或指示用户盲目审阅恢复。

PC导出的view仍为旧Synthetic/A组，和accepted的Moved/B、Moved/C组不同；iPad view匹配accepted。首版核验对“PC view匹配”的断言失败后已明确保留这一差异，不把它算作通过。报告缺图谱是否已建好/当前可见信息，尚不能确认是设置页导出时缓存未投影，还是实际图谱恢复异常。另列SYNC-G4-UI2/P2：先在原PC打开图谱等待更新、不编辑，补1报告及图谱截图再定位。暂不重置、重新加入、审阅或修改共享历史；UI1验收不受此待核对项替代。

FB2及FB5既有验收保持，PC本轮实际视图/提示单列未决。超长非空消息P3、G5–G8/发布门禁继续保留。

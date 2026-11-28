# 发布检查与历史记录

1.0.0已正式发布，整合一键同步与恢复修复；正式流水线、实际三资产下载和社区构建复现均通过，具体证据与保留边界见[发布记录](RELEASE_PREP_1.0.0.md)，固定来源见[基线](WORKSPACE.md)。旧正式证据见[0.0.17记录](RELEASE_PREP_0.0.17.md)，此前流水线与0.0.x说明保存在[历史记录](archive/RELEASE_CI_before_convergence_2026-11-24.md)。

## 当前流程

1. PR/主分支在只读仓库权限下执行npm ci与npm run check；开发依赖由锁文件固定，运行插件仍不依赖node_modules。
2. 正式tag必须是无v前缀、无前导零/后缀的X.Y.Z；必须与manifest/package/versions及对应非空发布说明一致。
3. 发布任务执行相同静态、类型、构建、合成、打包、边界和有限防漏检查，然后仅暂存main.js、manifest.json、styles.css。
4. 检查实际字节摘要并附构建来源证明；SHA256SUMS与说明放发布正文，不增加运行资产。
5. 手动dispatch只做验证，不创建Release。已有Release一律拒绝覆盖，不重新上传同号资产。
6. 只有最终源码/资产、设备和产品门槛满足且获得明确授权后才推tag/发布。当前候选的CI、演练和实际发布进度以准备记录为准，没有结果不得记为通过。

## 可复现性

原始模块正文参与bundle和provenance摘要，源文件须按.gitattributes使用LF。运行npm run workspace:check可在开工时发现偏离。冻结摘要之后修改行尾也必须重新构建，不能用版本号推断实际运行字节。

# 旧版本纯代码基线

`graph-core-0.0.9.mjs` 是 0.0.10 去重改动前保存的真实 0.0.9 核心模块，原本地路径 `.local/evidence/continuous-010/before-core.mjs`。仅含项目核心源代码及 export，不含笔记、图谱快照、配置或运行证据。

SHA-256：`06590366e68e999ef107311765a058a4c48b93643f3f0074a32d65d9ca54930a`。通过 `.gitattributes` 保留原字节。用于 schema1 迁移回归与核心性能对照；它不是旧插件完整安装包，不能据此宣称执行了旧版原生 A/B。

`graph-core-0.0.10.mjs` 是 0.0.11 schema3 改动前的真实 0.0.10 核心模块（schema2 布局），仅含项目核心源代码及 export。SHA-256：`5bdce7c0b495d8093814fe0a9ca196114211e558e98aebc185a7abe5971f6aa6`。用于 `scripts/layout_scale_ab_0_0_10.mjs` 同机对照与降级/迁移回归；它同样不是完整安装包。

不在此文件上实现新功能；活动源码仍是 `src/`。当前实现与旧基线由测试直接对照。

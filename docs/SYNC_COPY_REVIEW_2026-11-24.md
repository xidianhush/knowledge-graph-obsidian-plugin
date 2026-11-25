# 一键同步提示文字：评审与实施记录

创建：2026-11-24，更新：2026-11-25。源码基线：`f4ac01d`，同步体验继续采用`dddf14a`。状态：首轮五处文案已落地，用户在独立库体验后认为大体清晰；两处补充反馈已调整并技术核验，用户于2026-11-25确认更清楚，本轮提示文案验收通过。“正在准备图谱……”保留，原因匹配另列。首轮建议原文保留下方，当前生效文字以末节反馈调整为准。

## 范围

本稿共六处建议：五处可直接替换现有中英文值；“等待图谱可用”须先核对原因匹配，暂不算直接实施项。不开新worktree，不改机制、状态判断、授权、自动编排、按钮名称/数量、页面结构或默认折叠行为。正常使用仍是每台设备开启一次同步。

依据：读取正式easy面板、状态推导、宿主编排与词典；workspace:check通过；纯函数探针验证空历史和待审草稿的实际提示分支。没有重跑产品套件，不将历史真机结果计为本轮新通过。

## 1. 首次说明

键：`sync.easy.guidance`。现有位置不变，只在原有首次/准备/等待阶段显示。

原文：两端需使用相同建图范围，并让同步工具传输 “Knowledge Map Sync” 文件夹。只共享布局结果；建图范围、设置、视角和界面状态留在本机。

建议：**两台设备都开启此开关，并用坚果云等工具同步笔记和 Knowledge Map Sync 文件夹。两端请使用相同的建图范围，插件只同步布局。**

English: Enable layout sync on each device. Use your sync tool to transfer your notes and the Knowledge Map Sync folder. Use the same map scope on both devices. Only layouts are shared.

理由：先告诉用户怎样开始，再说明外部传输与范围前提；用“只同步布局”表达边界，不把内部状态分类全放在普通提示里。完整的数据与本机状态说明继续保留在现有高级区和指南。不能写成插件替用户同步笔记或配置云服务。

## 2. 等待图谱可用

键：`sync.easy.status.preparing`。

原文：正在准备图谱……

建议：**请先打开图谱，图谱就绪后会自动继续。**

English: Open the map. Setup will continue automatically when it is ready.

理由：宿主可能因graph-unavailable进入此阶段，旧文案像是在主动执行构图。新句子给出可做的动作，仍不让用户创建/查找共享布局。

适用边界：preparing还用于短暂的连接准备过程；实施前需用已有模拟场景核对该句是否会在无需打开图谱时停留。若不够精确，本轮可保留原句，另评是否仅对graph-unavailable使用这条提示，不能悄悄新增状态逻辑。

## 3. 本机共享资料已准备好

键：`sync.easy.status.awaitingTransfer`。

原文：已准备共享资料。请让同步工具传输 Knowledge Map Sync 文件夹。

建议：**本机已准备好。请用同步工具传输 Knowledge Map Sync 文件夹。**

English: Ready on this device. Use your sync tool to transfer the Knowledge Map Sync folder.

理由：替换抽象的“共享资料”，保留文件夹准确名称。空历史在两端准备完成后仍可能出现本状态，因此不能断言“另一台还没收到”，也不能提示用户必须等待某个可观测不到的云端进度。

## 4. 修改已在本机保存

键：`sync.easy.status.draft`。

原文：修改已保存在本机，正在准备共享文件。

建议：**修改已保存在本机，尚未写入共享文件夹。**

English: Changes are saved on this device and have not been written to the shared folder yet.

理由：该状态可能包含需要审阅的草稿，不能一概说有后台工作正在推进。探针确认存在layoutDraft、队列要求publication-review-required时，当前普通区仍会得到draft/check。新文案只说明确定事实。

单列事项：是否应在“确实需审阅”时指向现有“审阅并发布”，属于状态与动作呈现判断，不是替换文字即可解决。本轮不改该判断，不承诺这句能消除全部等待困惑，也不将它归因为同步传输机制有问题。

## 5. 发现多份候选

键：`sync.easy.status.selecting`。

原文：发现多份图谱。

建议：**发现多份图谱，请选择要使用的一份。**

English: Multiple shared layouts were found. Choose the one to use.

理由：补上异常分支的下一步；复用现有“选择图谱”按钮。单份候选仍自动选择，不把此动作变成日常必经步骤。

## 6. 需要明确审阅已有布局

键：`sync.easy.status.different`。

原文：这台设备与共享布局不同。

建议：**请审阅并确认这台设备要使用的布局。**

English: Review and confirm which layout to use on this device.

理由：此状态也承载本机旧布局校验等需审阅情况，不能总断言两份有效布局不同。沿用现有“审阅布局”按钮；不自动选本机/远端，不把“使用”写成另一份会被删除。

## 保持原样

- 开启布局同步、布局同步、高级与恢复、详情及所有动作按钮名。
- 正常本机保存、已写共享文件、同步关闭、冲突需决定的基本表达。
- 普通区一个开关、一句状态、至多一个主要操作，现有辅助说明的位置不变；不新增提示面板或配置步骤。
- 不显示“全设备同步完成”、未经验证的云端/另一端状态；技术原因码仍放详情。

## 已确认的验证范围

直接实施部分只替换五键的十个中英文值，核对差异后运行i18n检查与原一键面板宽窄/双语检查。纯文案不要求重复磁盘和全部历史设备验收。用户对文字的认可不等于安装后体验验收通过。preparing适用边界、draft动作呈现另列，不扩展本轮实施范围。

## 实施与验证结果

- 运行源码仅修改`src/i18n.sync.js`。VM比较HEAD与工作副本，确认只变更以上五键的十个值，键集合与其他值不变；独立只读复核与评审稿逐项一致。preparing、按钮、机制、状态映射及页面结构未改。
- `npm run workspace:check`通过。`npm run check`通过，包含静态/格式/类型门禁、519翻译键与41模板绑定、构建及45个合成脚本、打包与有限安全/基线检查。纯文案未新增测试脚本。
- 原`sync_easy_settings_sketch_check.py`的8项检查通过：真实DOM的四种状态、开关点击、检查按钮、折叠高级区历史恢复入口等。中英文×深浅主题×1360/390宽度×四种状态共32张截图，无横向溢出。
- 私有检查脚本复用同一生产渲染器/词典，注入draft、selecting、different三种phase/reason，另检查24种双语/主题/宽窄组合：状态文字未裁切/未越界、一个开关/一个主要动作、高级区默认折叠。此处是文案渲染检查，不是三种同步情境的端到端复现。抽看中文窄屏准备完成、英文窄屏未开启、中文宽屏审阅布局截图，未发现显示问题。
- 首次沙箱内浏览器启动停滞，未计为通过；停止后获准在沙箱外使用专用无头Chrome执行上述检查，退出0。不读取用户浏览器profile；未运行原生Obsidian、iPad或坚果云验收，也未重跑磁盘专项。
- `scripts/package.mjs --out .local/sync-copy/candidate-fd629be6`生成本地候选，仅含三运行文件及SHA256SUMS；三文件与dist逐字节相同，构建main含全部十个新文案值。未升级版本，仍是与已发布资产不同的0.0.17开发候选，不能据版本号覆盖已有Release。
- main.js：844035字节，SHA-256 `fd629be635fa3f9bab4d8939f3ae84098064535dc55afa54027033c5dff75082`。为基于f4ac01d的未提交文案候选；打包时尚未安装，后续独立库安装见下文；未推送或发布。

私有证据：`.local/sync-copy-check.log`、`.local/sync-copy-browser.log`、`.local/sync-copy/verification-summary.json`，截图及浏览器结果位于`.local/sync-copy/browser/sketch-mts1bczw/`。私有检查脚本`.local/run_sync_copy_browser.py`仅用于本轮渲染核验，不加入公共包。

用户体验验收范围：在独立测试库中检查未开启及首次准备完成时的提示是否自然、能否看懂同步工具需要传输哪些内容。维持每台设备开启一次开关的流程；已有布局不同和冲突仍走原审阅路径。不将技术记录视为用户验收通过。

## 独立测试库验收准备

2026-11-24用户要求开始独立库体验验收。新建`Knowledge Map Copy Trial`，只含Synthetic下两篇合成中文笔记，插件语言为中文，建图范围Synthetic/**。使用全新独立profile及本机已安装Obsidian 1.15.1应用代码，不复用任何日常库、旧验收库或用户浏览器配置。

- 已复制本轮候选main.js、manifest.json、styles.css；安装main SHA-256再次核对为`fd629be635fa3f9bab4d8939f3ae84098064535dc55afa54027033c5dff75082`。没有预制布局、共享资料或同步身份。
- 已启动独立Obsidian进程，原有Knowledge Map Sync UX PC窗口未操作。首次出现Obsidian“你是否信任这个仓库的作者？”对话框；按computer-use规则由用户手动完成“信任仓库作者并启用插件”，用户随后回复“点完了”。
- 继续通过返回窗口标题限定本库主窗口和独立设置窗口；打开Knowledge Map设置及图谱，原生状态显示构建完成：2篇笔记、9个节点、9条边。滚动至布局同步区域后，核对“开启布局同步”“在设备间共享图谱布局。”及批准的新首次说明显示完整，“高级与恢复”保持折叠。
- 开关仍未开启，未预先拖动元素，磁盘中Knowledge Map Sync文件夹尚不存在。保持这个首次使用页面供用户亲自阅读和开启；本轮原生开启后状态、用户文字体验与跨端传输均待验，不宣称完成。
- 本轮UI观察文字记录在对应trial目录的`native-idle-observation.json`；未重跑工程套件，不新增历史测试通过数字。

本机路径、安装文件摘要与启动PID留在`.local/sync-copy/acceptance-latest.json`和对应trial目录；不写入公开测试包。只在新建验收库中进行后续操作，不连接日常远端或触碰原有库。

## 2026-11-25首轮体验反馈及调整

用户亲自开启同步后提供截图：页面显示“本机已准备好。请用同步工具传输 Knowledge Map Sync 文件夹。”；用户认为下一步可用坚果云传输笔记改动和布局，表达大体清晰。该回报确认了首轮基本理解，不扩大为真实跨端传输成功或全部体验通过。

两处P2反馈的实际/期望：

- “两端请使用相同的建图范围”含义仍不明确，希望用可理解、能对应到界面设置的说法。
- “共享图谱”展开后只有数字串，希望标题明确这是ID。

已在原词典更新两键的四个中英文值，未改变同步机制、状态映射、页面结构或原动作按钮：

- guidance中文：两台设备都开启此开关，并用坚果云等工具同步笔记和 Knowledge Map Sync 文件夹。两台设备的图谱请包含相同的笔记（本页的“包含范围”“排除范围”和“排除笔记”保持一致）。插件只同步布局。
- guidance英文：Enable layout sync on each device. Use your sync tool to transfer your notes and the Knowledge Map Sync folder. Include the same notes in both maps: match the Include scope, Exclude scope and Excluded notes settings on this page. Only layouts are shared.
- current：共享图谱 ID / Shared map ID。仍默认折叠，无需用户复制或填写。

本轮新验证：workspace:check、npm run check全部通过（519翻译键、41模板绑定及构建/45合成脚本等门禁）；复用此前私有浏览器检查，32种原状态加24种注入文案状态组合通过。证据为`.local/sync-copy-feedback-check.log`、`.local/sync-copy-feedback-browser.log`及`.local/sync-copy/browser/sketch-2mxq07pf/`；后24种仍只代表注入状态的渲染检查。

本地候选`.local/sync-copy/candidate-feedback-20261125/`：main.js 844209字节，SHA-256 `d65b79e11279625c77434a83120baacb15d588888f7638c132954df69e980bb2`。关闭原独立库后备份旧运行文件，只替换三运行文件，安装前后核对Synthetic笔记、data.json和共享文件摘要一致；原profile、同步授权及布局资料保留。重开同一独立库后，原生页面显示新说明、“共享图谱 ID”、原默认ID `71e90242bea19488f2a16c60f78fcabc` 和仍启用的开关，状态仍为“本机已准备好”。未代用户修改开关或建立外部同步链路。

安装记录和原生页面文字记录留在trial目录的`feedback-install.json`、`native-feedback-observation.json`；旧运行文件备份在`before-feedback-runtime/`。源码差异审计确认相对f4ac01d合计只改六键的十二个中英文值，其他运行源码不变。未新增测试脚本，未升级版本、提交、推送或发布。用户于2026-11-25回复“我认为你新改的这两处更清楚了”，两处修改及本轮提示文案验收通过。该结论限已体验的首次说明、准备完成提示及ID标签，不扩大为全部异常文案、新用户可用性或当前候选真实跨端验证；现有Windows/iPad历史验收不计为本轮新通过。

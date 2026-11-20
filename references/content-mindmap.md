# 内容思维导图与 Markdown

## 默认视图与图表数据

首次打开只显示主题与页面标题这一层子节点。点击左侧某页展开该页，分支仍可按需展开；“折叠分支”回到一层总览。“全部展开”用于查看细节。已保存的折叠与缩放设置继续恢复，不因轮询或更新强制重置。

数据节点的 `labels` / `values` 必须是等长数组，数值为有限 JSON number（不能用字符串代替）；不要编造数据。bar、column、waterfall 允许真实负值，按零轴和累计值绘制，保持标签、单位、来源与解读。donut/share 仅支持非负百分比、合计 100%。无效数据的诊断包含 slideId、blockId 与具体数组索引；使用“定位本页”后展开“结构化数据”修正、保存并重新确认即可重试，不能为绕过校验而取绝对值或删除数据。

## 正确的先后顺序

分析材料前先阅读 [content-contracts.md](content-contracts.md)，查询候选版式的精确槽数、字段和数据边界。初稿必须有页面标题、内容块标题和有效的子要点标题；封面/章节不含正文块。先执行 `fit-plan` 检查结构与容量，新建入口拒绝结构错误；旧稿保留可编辑修复，不用重新创建或删除正文。

先通过统一入口的 `doctor` 核对完整安装，再生成草稿。用户选择精细模式后，找不到脚本/示例、Node 未在 PATH、依赖不齐都不是降级直出的授权；按 [installation.md](installation.md) 定位根目录和恢复组件，未修复前停止。两种模式不等效。内置示例在 `project/examples/content-demo.json`；`content-draft.json` 为任务输出，不应在安装目录中搜索它。

本文件用于已选择“精细模式”的分支。新任务先在 Agent 聊天中询问是否启用脑图精细梳理；没有选择不打开脑图。用户选择“否 / 直出”时，先完成受众、场合、核心诉求问答，再由 Agent 分析、拆解、提炼并视觉编排，使用 `direct --mode direct --plan ...` 直接打开 PPT HTML 预览，不经过本文件的脑图审稿步骤。需求记录写 `brief.workflowMode: "fine" | "direct"`，已有项目恢复保持兼容。

1. 在 Agent 聊天窗口中询问缺失的受众、场合和最重要要求。按需明确目标行动、时长、页数和图片授权。此时不创建项目、不启动浏览器；等用户回答。已有要求不重复问，明确全权委托时记录实际假设。
2. 基于回答分析材料前，按 `joint-visual-planning.md` 读取全库能力与候选约束；采用同一分档：图文＝实际3个及以上ICON > 其他ICON＝图表＝Highlight。结合关系、解释密度和真实素材/数据组织草稿，不先把所有页拆成统一卡片。生成中性内容及已确认 brief，标题给出论点，事实和数字有依据，不填模板 props。
3. `create --mode fine --plan` 先估算主题库容量，必要时完整搬移独立内容块并记录可撤销分页，再创建脑图项目；原稿保留。必须一页/固定页数、图表、媒体、关系和单块超容的处理见 [capacity-planning.md](capacity-planning.md)。随后 `start` 打开系统浏览器。新建入口校验模式；缺失返回 WORKFLOW_MODE_REQUIRED。需求缺失返回 AGENT_INTAKE_REQUIRED，回聊天补问，不能用网页访谈或默认答案绕过。
4. 用户在右向脑图中编辑、增删、调整分支或用 AI 微调，再确认页面或整套内容。脑图仅只读显示此前需求，不进行首次需求访谈。
5. 只消费确认快照，统一匹配完整 Theme17 主题库，做全篇视觉策划、渲染、实测和导出。`fit-plan` 的 `visualPlanning` 与逐页 `recommendedLayout / visualStrategy` 使用和最终生成相同的分档及全篇相邻约束；只是建议，不锁定模板。脑图编辑、AI改稿后重新检查，最终按最新确认内容再选版，不退化为基础卡片套版。

```json
{"title":"经营改善需要打通交付瓶颈","goal":"形成管理判断与行动建议","audience":"经营管理层","brief":{"audience":"经营管理层","occasion":"内部经营复盘","priority":"突出风险、证据与待决策事项","decisionGoal":"明确下一季度资源投入","duration":"15分钟","imagePolicy":"none","workflowMode":"fine","confirmed":true},"slides":[{"slideId":"cover-1","role":"cover","title":"交付改善带动经营提质","conclusion":"聚焦关键问题与行动闭环","blocks":[]},{"slideId":"body-1","role":"body","title":"跨团队交接是改善交付的关键","conclusion":"先统一交接和验收标准。","blocks":[{"blockId":"point-1","type":"insight","label":"交接标准","text":"统一输入、责任和验收条件。","evidence":"内部访谈"}]}]}
```

Agent 先写这个 JSON 草稿，再由工作台生成可交互脑图与结构化 Markdown。也可通过 Markdown 导入已有内容。无需另外的大型前端依赖或在线 CDN；内网可本机运行。

## 脑图结构与交互

主题 → 页面论点 → 核心结论 / 内容块 / 页面来源 / 视觉建议；内容块 → 正文子要点 / 来源 / 结构化数据。正文子要点可继续嵌套，稳定 ID 保留。数据使用独立 JSON 节点，不伪装成普通文字。

- 单击选择，双击 / F2 编辑；侧栏显示完整文字，画布长文摘要最多四行。Ctrl+Enter 保存节点，Esc 取消未提交修改。节点草稿可暂存、继续或取消，不覆盖正式稿。
- Tab 新增子主题；Enter 新增同级；Delete / Backspace 删除前确认，删除整个子树可撤销。页面 / 内容块 / 正文子要点遵守其语义层级，证据和数据不能随意变为页面。
- 拖动节点：上沿前插，下沿后插，中间作为子主题。页面可排序，内容块可跨页移动，正文子要点可调整层级。禁止移动到自身后代。Ctrl+Alt+↑/↓ 同级排序；Alt+→/← 对正文子要点缩进 / 取消缩进。
- 方向键导航，左右键展开 / 折叠与进入子主题；Home 根主题，End 当前视图最后节点。节点折叠按钮、全图/分支聚焦、展开/折叠全部、适应画布均可用。
- 普通鼠标滚轮默认以指针为中心缩放，也支持工具栏 ±；Shift+滚轮横向平移，拖动空白区域自由平移。视图位置、缩放和折叠单独保存在本地，不改变确认内容。
- Ctrl/Cmd+F 搜索整个脑图，点击结果自动展开祖先并定位。Ctrl/Cmd+D 复制分支。
- Ctrl/Cmd+S 保存当前节点草稿及关键版本。节点结构、文字、AI 已应用修改、确认和任务控制都使用持久化撤销/重做：Ctrl/Cmd+Z；Ctrl/Cmd+Shift+Z 或 Ctrl+Y。
- AI 桥接点击后立即派发，显示进度；局部按启用的自动应用设置更新脑图，整套结构先预览再接受。暂停终止当前请求，继续会重新执行；取消后的旧 runId 禁止写回。撤销已应用修改不会再次调用模型。

这些是参考常见脑图交互的内容编辑能力，不宣称完整复刻 Obsidian、MindManager 或百度脑图。

生成按钮下方常驻本次 PPT 任务进度条，显示百分比与实际阶段，支持暂停、继续、取消；继续从安全步骤重新执行，不宣称逐字节断点续传。下方任务栏和右侧状态同步诊断记录的已处理/清除状态，不再把已清除的旧失败持续显示为当前报错。新的运行 ID 发生错误仍正常提醒；清理显示不删除任务审计记录，也不意味着通过校验。

## 诊断与 AI 处理候选

错误浮层可用“×”关闭，“查看详情”打开统一诊断控制台；顶部入口常驻。控制台记录操作 / 预检 / AI / 生成失败，显示错误代码、时间、失败阶段、页码、具体问题与建议，支持定位问题页、筛选、标记已处理、清理和导出脱敏 JSON。关闭或标记已处理不代表校验通过，也不会终止任务。即时操作记录保存在当前浏览器的项目本地存储；AI 与生成任务的结构化失败同时保存在项目 JSON，刷新后可重建。控制台最多保留 100 条显示记录，不收集模型密钥或私密配置。

生成区和容量错误详情均提供“AI 精炼候选 / AI 拆页候选”。选择目标页，可补充要求，然后点击“生成候选（不改正式稿）”。沿用侧栏执行方式：自动 Agent / 模型服务立即执行并显示进度；手动桥接明确提示等待外部 Agent，不冒称已执行。候选任务可暂停、继续、取消。精炼限当前页，拆页允许在目标页之后新增页，但后端禁止删除、重排或改写其他原有页面。默认保护原有数字，事实、来源、数据与媒体不得丢失或补造。

这两类任务始终使用 proposal 模式，即使侧栏开启自动更新也不会直接覆盖当前稿。预览前后完整内容，接受 / 拒绝；接受后自动更新脑图，支持撤销 / 重做，再确认受影响页并重新预检生成。正式稿期间已变动则阻止旧候选覆盖。控制台的历史问题可能来自旧内容版本，应重新预检判断是否仍存在。

## Markdown 与保存

项目维护 `content-original.md`（最初稿）、`content-current.md`（当前稿）、`content-confirmed.md`（最近确认稿）。`content-plan.json` 保存同一内容的稳定 ID、事务历史、AI 任务和生成版本。Markdown 是用户可编辑和交换的结构化内容；JSON 是运行时事务表达，不是第二份独立手改稿。

“Markdown”菜单支持双向编辑、导入、暂存和校验应用，所有应用均可撤销。导入支持：

1. 本工具的嵌套列表 Markdown：主题为一级标题，各节点带隐藏的 `<!-- dashi:{...} -->` 注释，保存角色、ID、数据及兼容信息。文字中的换行与特殊字符安全编码，往返不丢来源、图片引用、数值或稳定 ID。编辑可见文字时保留元数据注释。
2. 普通 Markdown：`# 主题`、`## 页面论点`、`### 内容块`、正文和缩进列表。导入普通 Markdown 时沿用已确认的 brief；新增 ID 由工具生成，应用前校验。

```markdown
# 经营改善需要打通交付瓶颈
## 跨团队交接是改善交付的关键
### 交接标准
统一输入、责任和验收条件。
- 输入条件
  - 明确前置交付物
- 验收标准
```

正文嵌套保存为 contentTree，并无损投影到正文的缩进要点；最终 PPT 生成必须保留所有文字。AI 只改主段落而不改子分支时保留原分支 ID；无法安全重建层级时保留完整原文，不丢字。旧 `board` 字段仅作为已有关系及生成器兼容数据，不再作为用户界面的 16:9 白板。

手工在磁盘外部修改 Markdown 不会自动覆盖正在编辑的事务：用导入 / CLI 携带 revision 显式应用，避免多窗口冲突。

导出菜单提供完整内容 Markdown / JSON，及当前展开分支视图 SVG / PNG。图像是脑图截图，不替代包含完整长文的 Markdown。导出 PPT 仍在内容确认后走原演示控制台。

## CLI 与接口

`node <skill-root>/scripts/content-workbench.mjs <command> --project <目录>`

| 命令 | 用途 |
| --- | --- |
| route | 未传 `--mode` 返回标准问询；`--mode fine或direct` 返回分支，无文件/浏览器副作用 |
| fit-plan | `--plan draft.json [--out fitted.json]`；打开脑图前估算容量/无损分页，输出逐页报告，不改输入 |
| direct | `--mode direct --plan Agent已提炼的内容.json --host 实际宿主`；不打开脑图，直接生成 PPT 预览 |
| create | `--mode fine --plan draft.json [--brief brief.json] [--source source.md]`；模式和 brief 来自先前 Agent 对话 |
| import-goal | `--goal goal.json --brief brief.json`；无损保留旧 goal，明确其缺失语义 |
| start / serve | 后台启动 / 前台运行；可选 `--port 5490 --no-open`；启动前校验需求 |
| get / status | 当前项目、revision 和审核进度 |
| write | `--plan edited.json --revision N`，仅改动页面重新待确认 |
| export-markdown | `[--out content.md]`；默认 stdout |
| import-markdown | `--file content.md --revision N`，保留原稿和撤销历史 |
| confirm | `[--slide slideId] --revision N`，逐页 / 整套确认 |
| undo / redo | `--revision N`，跨刷新持久化 |
| checkpoint / restore | `--label 名称` / `--id original或版本ID`，均需 revision |
| generate | `--revision N [--planner bridge\|provider\|rules] [--no-preview]`，消费确认快照 |
| request / tasks / submit / decide | 保留原 Agent 桥接协议，整套改动只接受显式确认的候选 |
| pause / resume / cancel | `--task ID --collection aiTasks或generations --revision N` |

HTTP：GET `/api/project|status|markdown|tasks|model|bridge`；POST `/api/document|markdown|action|ai/request|ai/refine|ai/submit|proposal/decide|task/control|workspace/control|generate|compile-check|model|model/test|bridge`。写操作携带 revision，前端也传 contentRevision。所有 API 仍需工作台 URL 中的 token，Origin 限制及只绑定回环地址保持不变；密钥仅存 `.private/`。

## 视觉生成与模型

沿用完整 Theme17 主题库查询、容量和媒体槽契约。图表只使用真实数据；图片先用 media:stage，引用 `assets/user-media/...`，无授权不补图。专用 bar / column / donut/share / waterfall 图表和单位检查保留。确认后不擅自精炼、删来源或改页数；放不下先有限更换版式，仍失败则回脑图确认调整。

每次生成保存确认快照、`visual-plan.json` 和 `content-mapping.json`，实际浏览器逐页核对完整文字、来源、关系、数据单位、图片和裁切。通过才发布成功并打开演示控制台；原版固定封底、华为视觉规范与导出器保持不变。

## 生成后的逐页换版

顶部“单页版式”打开右侧“当前页排版样式”下拉菜单；面板收起时保留悬浮入口。依赖就绪后才标记初始化成功，失败可“重新读取版式”。菜单按照完整正文、来源、真实数据、媒体、显式关系和容量筛选，包括合适的原主题库布局及咨询式条目、无卡片双栏简报、重点聚焦和弹性 Bento 等注册版式，不强制使用高密度卡片。条形/柱形仅在数据语义相同且容量通过时互换，不擅自改为占比或瀑布。封面、章节和固定封底维持已验收模板，菜单说明不可换版原因。

选中后只重生成本页，显示实际阶段进度，可暂停/继续/取消；浏览器完整内容/溢出检查通过才替换。原页一直保留到成功发布；失败、取消或等待期间本页已有新编辑时不覆盖。能明确映射的当前文字、数据、图片与单元素字体样式会迁移；复杂编辑无法唯一映射时明确拒绝，要求先在脑图确认，不静默丢弃。切换支持撤销/重做，复用已验证快照不重复调用 AI；状态自动保存，明确显示“正在保存版式 / 版式已保存”。保存进行中或失败时离开页面触发浏览器保护，避免立即刷新读到旧稿；等待保存完成后再刷新。保存快照重新绑定目标页的稳定 key 与整套页序，不使用单页临时渲染的索引。

旧演示须带 `confirmed-content.json` 与 `content-mapping.json` 才能安全换版；缺少时要求从脑图重新生成，不能猜测旧页的内容归属。快照仅保存在当前演示目录 `.layout-cache/`，服务不接受用户提交的任意 HTML 覆盖页面。

更多原主题版式通过“需 AI 适配”分支开放，不再要求全文原样直接塞入。适配前明确授权精炼和分组，过程显示进度，完成后展示完整前后对比、内容去向与真实页面预览，用户确认才应用。详见 [layout-adaptation.md](layout-adaptation.md)。直出模式的新项目同样保留内容映射与绑定宿主，可使用这个审阅能力；传统缺中性内容映射的 goal-only 旧演示不伪装为支持。

Agent 自动桥接支持 DeepSeek Harness、OpenCode、Claude Code、Codex CLI 与标准 JSON Worker。创建 / 启动时由当前 Agent 加 `--host deepseek|opencode|claude|codex`，或用 `--host-file adapter.json` 绑定其他宿主。绑定持久保存在项目中，不按 PATH 顺序自动换 Agent；DeepSeek 的模型路由与登录继承见 [agent-bridge.md](agent-bridge.md)。Provider 继续支持用户已配置的 OpenAI-compatible 接口。无可用入口明确报错；视觉策划降级会记录为完整主题库规则匹配，不冒称 AI 成功。不自动发现或绕过员工助手封装中的私有接口或凭据。

OpenCode 在脑图就绪并由默认浏览器打开后结束本次 Agent 调用，不轮询等用户；后续修改、确认和生成由工作台自己执行。

## 验证与交互参考

`npm run test:content` 覆盖内容、历史、脑图/Markdown 往返、结构变换、需求前置门禁和 API；`npm run test:content:e2e` 覆盖脑图真实浏览器交互和最终 PPTX 导出；语义长案例与图表回归继续保留。

交互模式参考公开项目 [Mind Elixir](https://github.com/ssshooter/mind-elixir-core)（节点、快捷键、历史、Markdown）与 [SimpleMindMap](https://github.com/wanglin2/mind-map)（脑图结构和编辑体验）。实现为本 Skill 的轻量本地编辑器，没有复制这些项目的代码，也不依赖外部 CDN。

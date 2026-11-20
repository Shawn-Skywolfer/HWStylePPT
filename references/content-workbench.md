# 旧白板工作台说明（0.5.0，已停用）

此文档仅保留旧版本协议背景，不再是默认流程。0.6.0 起必须在 Agent 聊天中先完成需求问答，再打开右向 Markdown 思维导图；不再使用白板或浏览器访谈向导。现行流程与接口见 [content-mindmap.md](content-mindmap.md)。

## 白板与操作约定

- 每页为 1280×720 的 16:9 白板，标题、结论、事实、观点、数据、行动、风险和证据按语义排布。左侧使用白板缩略图导航。
- 以 `visualIntent` 和页面角色推断并列、流程、对比、上下支撑等初始排布。允许在 `board` 中明确节点位置与关系；不只输出一串无关系段落。
- 单击内容块查看和编辑，双击进入编辑框；Ctrl/Cmd 单击多选。可新增、复制、删除内容块与页面，页面可排序。
- 拖动块体移动，右下角手柄缩放，Shift 保持比例；可开关网格和吸附。Esc 取消未提交的拖动。新增块与未保存编辑可暂停暂存、继续或取消。
- “连线”后依次点击两块；点击已有连线可修改支撑/因果/顺序/对比关系及文字，或删除。连线跟随节点位置。
- 所有正式内容与排布修改、确认、任务创建和任务控制都进入持久化撤销/重做。瞬时操作完成后使用撤销恢复；未完成的输入使用取消，不伪装成可暂停的后台任务。
- AI / PPT 生成任务支持排队、执行、暂停、继续、取消及进度。暂停会中止本次上游请求/子进程，保留任务上下文；继续会重新执行，不承诺从模型的中间 token 续写。取消后旧 runId 的结果禁止写入。
- 顶部暂停作用于工作台及运行任务；顶部取消终止进行中的任务并丢弃当前未提交编辑，不删除已保存内容。撤销/重做 AI 已应用修改不会再次调用模型。
- 白板是内容与逻辑策划层，不承诺像素级复刻。正文块的空间顺序、排布模式与显式连线参与实际编排；连线会显示在最终页面。自由排布使用块体坐标，但必须满足边界、保留区和无重叠约束。最终视觉细调仍在演示控制台进行。

## 默认生成流程

1. 读用户材料，提炼目标、受众、页数、论证主线与证据。标题表达本页观点，不捏造数据。
2. 写中性的 `content-draft.json`，不写 Theme17 props。每页提供完整标题、核心结论、内容块、证据与视觉建议。封面/章节页只承载标题（封面可有简短摘要），正文放在独立页面。
3. 用 `create --plan` 建项目，`--source` 接收 UTF-8 MD/TXT 原文。其他格式由 Agent 先抽取文本，并在 `--input` 保留源文件引用。创建时生成稳定 ID，最初稿永久保留。
4. 运行 `start` 自动打开系统浏览器。看到 `DASHI_CONTENT_REVIEW_READY=1` 后，回复工作台地址并结束本次 Agent 调用。不要轮询等待用户，不要在确认前渲染最终 PPT。
5. 用户在工作台确认后点击“生成 PPT”，或由任意 Agent 读取状态再执行 `generate --revision N [--planner bridge|provider|rules]`。只消费确认快照。先对全篇内容搜索完整主题库，再由已选 Agent/模型统一选择安全候选，之后渲染及实测；不重新撰写已确认文案。CLI 默认 rules，工作台按“调用方式”使用 bridge/provider；手动桥接使用完整库规则匹配。执行器不可用或返回不合法选择时明确记录降级，不声称调用成功。

## 先问清需求，再策划内容

新任务先逐问明确 audience（受众）、occasion（场合）、priority（最重要要求），可补充 decisionGoal（期望判断/行动）、duration（时长）、imagePolicy（none / upload / placeholders）。已有答案无需重复追问，但不能代替用户确认。保存到顶层 `brief`，确认后 `confirmed:true`；内容编辑及全篇版式策划都接收这些上下文。工作台首次打开会补齐缺失需求，可暂停暂存；保存需求可撤销/重做，修改后整套内容须重新确认。生成接口未完成需求时返回 `BRIEF_REQUIRED`。

```json
{"brief":{"audience":"经营管理层","occasion":"内部经营复盘","priority":"突出风险、证据及待决策事项","decisionGoal":"确认下一季度资源投入","duration":"15分钟","imagePolicy":"none","confirmed":true}}
```

白板是可审阅的内容分析结果，不是预选最终模板。粗略拖动、内容增删及 AI 修改完成后，统一重新匹配全篇视觉设计；不得退化成一个固定基础版式套到底。图片仅使用提供素材或明确授权的上传槽：`slides[].media:[{"src":"assets/user-media/project-image.png","kind":"image","caption":"说明"}]`，先用 media:stage 将文件放入项目 assets/user-media；生成时复制到输出。禁止 loose assets 路径或伪造文件。无媒体不代表不画逻辑图或真实数据图表。
6. 保存 `visual-plan.json`（选择理由、候选、几何、关系）与字段级 `content-mapping.json`；调用原渲染器，自动追加原版固定封底。
7. 真实浏览器读取最终 DOM，核对每个 blockId 唯一呈现、正文/来源各自完整、连线匹配、图片加载、画布边界、重叠与溢出。必须通过后才启动原 HTTP 演示控制台并标记成功。

首次安装在 Skill 的 `project` 目录运行 `npm install`。内容编辑、恢复与 Agent 桥接只需 Node.js，生成与导出使用原依赖。

## 中性内容格式

```json
{
  "title":"经营改善需要打通交付瓶颈",
  "goal":"向管理层汇报经营判断与行动建议",
  "audience":"管理层",
  "slides":[
    {"slideId":"cover-1","role":"cover","title":"交付改善带动经营提质","conclusion":"聚焦问题、措施与责任闭环","blocks":[]},
    {"slideId":"body-1","role":"body","title":"流程协同是改善交付的关键","conclusion":"先解决跨团队交接，再扩大自动化覆盖。","blocks":[
      {"blockId":"point-1","type":"paragraph","label":"交接标准","text":"统一输入、责任与验收条件。","evidence":"内部访谈"},
      {"blockId":"point-2","type":"bullet","label":"管理机制","text":"建立每周问题闭环，追踪交付偏差。"}
    ],"evidence":"内部调研","visualIntent":"使用并列内容卡片"}
  ]
}
```

ID 只能用字母、数字、连字符和下划线，项目内唯一。缺失 ID 仅在创建/提案新增时生成；修改时保留既有 ID。
页面字段：slideId、order、role、title、conclusion、blocks、evidence、visualIntent、status、version、board。
内容块：blockId、type、label、text、evidence、可选 data。内容按纯文本安全显示，不运行 HTML。结构化柱形数据会在内容块中提供示意图。

`board` 是可选的中性白板数据，缺失时自动生成，不改动最初稿。格式示例：
```json
{"width":1280,"height":720,"mode":"flow","nodes":[{"nodeId":"block:point-1","x":48,"y":236,"w":360,"h":360,"z":2}],"edges":[{"edgeId":"link-1","from":"block:point-1","to":"block:point-2","kind":"causes","label":"驱动"}]}
```
标题、结论和证据节点 ID 分别为 `meta:title`、`meta:conclusion`、`meta:evidence`。缺失节点自动补齐，删除块时清理悬空连线，位置和尺寸限制在白板内。

`content-plan.json` 保存 projectId、revision（全部事务）、contentRevision（内容变化）、source、original、current、confirmed、history、checkpoints、aiTasks、proposals、generations、mapping、workspacePaused。最初稿只读，正式稿仅手工保存、接受提案或通过用户启用的自动应用后更新。确认稿使用独立快照与哈希。生成目录记录 goal、确认内容、ID 映射和日志，共用 projectId / slideId / blockId / generationId。

## 通用 CLI

所有命令：`node <skill-root>/scripts/content-workbench.mjs <command> --project <目录>`。Windows 路径用引号。

| 命令 | 参数与用途 |
| --- | --- |
| create | `--plan draft.json [--source source.md] [--input 原始引用]`，不覆盖既有项目 |
| import-goal | `--goal goal.json`，保留完整原 goal 与字段来源，提示语义缺失 |
| start / serve | 后台启动 / 前台运行。可选 `--port 5490 --no-open` |
| get / status | 完整项目 / 页面审核进度与 canGenerate |
| write | `--plan edited.json --revision N`，被修改页重新标记待确认 |
| confirm | `[--slide slideId] --revision N`，逐页或整套确认 |
| undo / redo | `--revision N`，跨刷新持久保存的撤回/重做 |
| checkpoint / restore | 保存 `--label 名称`；恢复 `--id original或版本ID`，均需 revision |
| request | `--request edit-request.json --revision N [--auto]`，默认创建手动桥接任务；auto 由运行中的工作台执行 |
| pause / resume / cancel | `--task ID --collection aiTasks或generations --revision N`，暂停、继续或取消任务 |
| tasks | 待处理任务、明确选区与模型消息，不含 API Key |
| submit | `--task taskId --result proposal.json --revision N`，只提交提案 |
| decide | `--proposal proposalId --accept --revision N`；仅用户明确接受时使用，不加 accept 表示拒绝 |
| generate | `--revision N [--no-preview]`，必须全部确认。用户明确无需审稿才加 `--fast` |

写入前先 get/status 读取 revision，冲突报 VERSION_CONFLICT，不自动覆盖。原子写入与跨进程锁防止半写文件。关闭后用同一目录的 start 恢复。后台日志和模型配置位于 `.private/`，不得加入安装包。

## 模型与 Agent 桥接

支持任意 OpenAI-compatible Chat Completions 服务。在模型设置输入 Base URL（通常 /v1 结尾）、Model、Key、temperature、maxTokens、timeoutMs，并测试连接。也可启动前设置 `DASHI_AI_BASE_URL`、`DASHI_AI_MODEL`、`DASHI_AI_API_KEY`。环境变量优先，环境密钥不复制到配置文件。模型配置仅存项目 `.private/model.json`，服务只绑定 127.0.0.1，无配置文件下载路由，不把 Key 写入 HTML/PPT。Windows 依赖项目目录的当前用户访问权限，不要共享私密项目目录。

默认“Agent 桥接（自动执行）”会在点击“AI 修改”后立即启动本地已配置的 Agent CLI。自动探测优先 OpenCode，其次 Claude Code；继承当前用户已配置的模型与登录状态，也可在工作台的“模型 / Agent”二层菜单指定可执行文件、模型与超时。不要要求原聊天 Agent 留在循环中等待，工作台自己维护任务队列和进度。

局部/整页任务默认校验后自动应用并刷新白板；用户取消“自动更新”时生成待接受候选。整套结构修改始终先预览。默认保护数字、限制修改范围、检查 before 原文与版本；无关节点移动允许安全合并，同一段文字被其他操作修改时拒绝覆盖。

内网员工助手若把 Agent 完全封装在进程内，未提供可调用 CLI 或 API，不能仅凭网页发现并复用它。此时由运维提供标准 JSON Worker 接口，或使用独立模型服务；最后才用“外部 Agent 手动桥接”，通过 tasks/submit/decide 协同。没有可用执行器时显示明确错误，不把模拟响应描述为真实 AI 编辑。

自动桥接配置只保存在项目 `.private/agent.json`，不包含在安装包中。环境变量可用 `DASHI_BRIDGE_COMMAND`（绝对路径）与 `DASHI_BRIDGE_KIND`（opencode / claude / json-worker）指定。Windows 的自定义入口使用真实 exe 或 Node 入口，不拼接 shell 命令。CLI 适配遵循 [OpenCode CLI](https://opencode.ai/docs/cli/) 和 [Claude Code headless](https://code.claude.com/docs/en/headless) 的 JSON 事件流；工具调用默认关闭，桥接仅返回结构化文本修改。

标准 JSON Worker：启动配置的 command + args；stdin 一行 `{"protocol":"dashi.content-edit.v1","taskId":"...","scope":{},"messages":[]}`；stdout 可连续输出 `{"type":"progress","detail":"正在处理","percent":30}`，最终一行 `{"type":"result","result":{"summary":"...","operations":[]}}`。进程退出码为 0；取消时终止工作台自己启动的进程树。Worker 不得自行写正式稿，由工作台校验和应用结果。

请求：
```json
{"scope":{"kind":"selection","slideId":"body-1","range":{"field":"block","blockId":"point-1","start":0,"end":10}},"prompt":"精炼这段文字","preserveNumbers":true}
```
索引采用 JavaScript UTF-16。多块选择用 blockIds 代替 range；整页用 kind:slide,slideId；整套用 kind:deck。服务端拒绝越界、原文不匹配与过期提案。默认保护数字，用户明确允许改数据时可关闭。

提案：
```json
{"summary":"精炼表述","operations":[{"op":"replaceText","slideId":"body-1","target":{"field":"block","blockId":"point-1"},"before":"统一输入、责任与验收条件。","after":"统一交接与验收标准。"}]}
```
field 可为 title / conclusion / evidence / visualIntent / block / blockLabel / blockEvidence。局部 range 需携带相同 start/end；整页支持 replaceSlide 且保留 slideId；整套另支持 deleteSlide / addSlide / reorderSlides。具体可执行规则见 `project/scripts/content/proposals.mjs`。跨页删、合、排只生成候选，用户接受后写入。后续 Prompt 沿同一任务继续，始终对最初正式稿生成完整操作集。

HTTP API 需启动地址中的会话 token，放入 X-Workbench-Token 请求头。GET `/api/project|status|tasks|model|bridge`；POST `/api/document|action|ai/request|ai/refine|ai/submit|proposal/decide|task/control|workspace/control|generate|compile-check|model|model/test|bridge`。写操作携带 revision；前端还传 contentRevision 以容忍进度更新但拒绝内容冲突。跨 Agent 优先 CLI，无宿主私有依赖。

## 语义编排与容量门禁

正文首先检索完整 Theme17 原主题库，通过共享 `listLayouts` / `inspectLayout` / `normalizeProps` 和原 goal 校验器筛选：完整内容块及字段容量、信息角色、媒体数、来源区、关系和隐藏辅助区契约必须匹配。不能把无数据文字填入数值图表。全篇候选及理由保存到 `visual-plan.json`；Agent/模型只返回 chooseLayout 操作，不能返回新文案或任意 props。原主题候选不能完整容纳时才使用 `theme17_content_columns / flow / comparison / hierarchy / free` 备选。封面、章节及固定封底保持原样。

每块内容拥有独立 label / text / evidence；数据不能 JSON.stringify 后伪装正文。每块一次性映射到同一 article，不能跨正文区/步骤区/注释区拆放。显式流程/因果边参与阅读顺序，循环必须先处理。编排器尝试均衡/内容量自适应列宽和行列组合，字号保持可读，不以无限缩字解决容量。新原生正文布局允许复用，避免为了固定模板不重复而选择不相关的信息角色。

每个原模板遵守其独立容量，自适应备选最多 6 个独立文字块。超容量返回 `LAYOUT_REVIEW_REQUIRED`，可准备 AI 精炼或拆页候选，但默认关闭自动应用，等待用户确认。不得自动改写、截断、拆句、删除证据或增加页数。浏览器逐页激活后核对可见内容，不把旁路 JSON 当作显示成功；发现缺文/裁切先换版式，最多重试两轮，仍不通过则返回 `RENDERED_CONTENT_FAILED`，不发布 ready。缺少浏览器或依赖明确失败。关系、轴及数据文字使用 HTML，SVG 只含几何。

中性数据模型支持 bar（条形）、column（柱形）、donut/share（百分比占比）、waterfall（各项非负贡献累加，另显示计算合计）。每页一个图表数据块，labels / values 必须等长且数值有限、非负；2–12 项，占比图 2–6 项并合计 100。格式：`{"kind":"bar","labels":["甲","乙","丙"],"values":[12,20,8],"unit":"万元"}`。优先使用 `theme17_chart_*` 专用契约，单位、标签和数值都是 HTML；原图表只有业务单位/标签语义完全吻合才可成为候选，不能沿用写死的“亿美元”“月”等字样。专用图表仍可在演示控制台的二层数据菜单中修改、撤销/重做并导出。未支持的复杂结构返回明确错误，不伪装成正文；可用旧 goal 保留原专用契约。

旧 goal 完整保留、逐字段恢复路径和原类型，编辑仍写回原布局。新增/删除旧字段块时切换中性文字编排并检查容量。旧 HTML 的视觉编辑状态不自动反推策划语义，原 HTML 仍可独立使用。

测试：`npm run test:content` 覆盖业务、语义归属、容量、循环和图表防误用；`npm run test:content:e2e` 检查白板、AI 和导出；`npm run test:content:semantic` 使用长案例真实渲染/导出，逐字段核对 PPTX，并故意制造缺文和溢出，验证门禁能够拒绝。fixture 仅验证协议与交互，不是生产 AI 响应。可选真实 Agent 测试：设置 `DASHI_LIVE_BRIDGE=1` 后运行 `node tests/content/live-bridge-check.mjs`，会实际调用已登录 Agent、消耗其额度。

P1 可在同一项目增加 generation 级页面版本，用 slideId/blockId 对应 content-mapping.json，将 HTML 编辑写入统一 checkpoints/events。P0 不更改原视觉编辑状态格式或导出 DOM。

/* Console chrome only. Never translate slide content, form values or raw logs. */
export const CONSOLE_EN = {
 '查看并确认关系调整':'Review relationship changes','查看需确认的关系变化':'Review relationship changes',
 '插入':'Insert','查找':'Find','编辑':'Edit','删除':'Delete','应用':'Apply','保存':'Save','取消':'Cancel','关闭':'Close','复制':'Copy','恢复':'Reset','替换':'Replace','可选':'Optional',
 '文本框':'Text box','文字':'Text','内容块':'Content block','矩形':'Rectangle','图形':'Shape','连线':'Line','箭头':'Arrow','图片':'Image','图标':'Icon','表格':'Table','图表':'Chart','模块':'Module',
 '宽':'Width','高':'Height','底色':'Fill','边线':'Border','颜色':'Color','单位':'Unit','标签':'Label','数值':'Value','标题':'Title','正文':'Body','来源':'Source','证据':'Evidence','备注':'Note',
 '未选择文字':'No text selected','请在幻灯片中点击需要调整的文字':'Select text on the slide',
 '字号、颜色和字体仅作用于此文字':'Font settings apply to this text only','恢复字号':'Reset size','恢复所选文字默认字号':'Reset selected text size',
 '未选择图形':'No shape selected','点击矩形、卡片或图表外框；Alt+点击文字可选外层图形':'Select a shape or card. Alt-click text to select its container.',
 '相邻元素自动跟随并保持间距':'Move adjacent elements and preserve spacing',
 '右侧手柄改宽，底部手柄改高，右下自由缩放，右上圆点等比例缩放。':'Right: width · Bottom: height · Bottom-right: free resize · Top-right: proportional resize',
 '拖动红框移动；使用四个手柄缩放':'Drag the outline to move; drag handles to resize',
 '拖动移动 · 四向缩放':'Drag to move · Resize with handles','恢复图形':'Reset shape','主题默认':'Theme default','作者信息':'Credits',
 '图片设置':'Image visibility','不显示':'Hide','显示图片':'Show image',
 '全部关闭时自动切换为无媒体布局；打开后可在画布中上传并裁切。':'Hide all images for a text-only layout. Enable a slot to upload and crop.',
 '配图与 AI 生图':'Images & AI generation','使用顶部“插入 → 图片”添加图片框。':'Add a slot with Insert → Image.',
 'AI 默认关闭；链接导入和本地上传无需开启 AI。图片可随时替换或撤销。':'AI is off by default. Upload or import a link without AI. Replacing an image is undoable.',
 '尚未开启图片框。先在上方“图片设置”中选择“显示图片”；没有图片开关时，请先选择标有“可配图”的正文版式。':'Enable an image slot above, or choose a media layout.',
 '本地上传':'Upload image','网上图片链接':'Image URL','下载图片并预览':'Download & preview','浏览器通道下载并裁切':'Download in browser & crop','浏览器打开原图 ↗':'Open original image ↗',
 '只读取公网 PNG / JPEG / WebP 原图，最大 15 MB；不支持网页链接、登录链接或内网地址。无需开启 AI。':'Public PNG / JPEG / WebP images only, up to 15 MB. Web pages, sign-in links and private addresses are not supported. No AI required.',
 '服务端下载失败或使用 Fake-IP 代理时，可手动选择浏览器通道。不携带登录凭据、不修改代理/DNS；若网站不允许跨域读取，请保存原图后本地上传。':'If server download fails, try the browser channel. No sign-in credentials are sent and no proxy/DNS settings are changed. If cross-origin access is blocked, save the image and upload it.',
 '启用 AI 文生图（默认关闭）':'Enable AI image generation (off by default)',
 '点击“生成一张”后，提示词会发送给当前图片服务，可能产生费用；不会发送整份报告。':'Generate sends your prompt to the selected image service and may incur a charge. The full report is not sent.',
 '图片服务来源':'Image service','复用当前 Agent 图片配置':'Use current Agent image configuration','独立配置图片服务':'Configure image service',
 '图片接口 Base URL':'Image API base URL','图片模型 ID':'Image model ID','API Key（仅保存在本机私有配置；留空保留已有值）':'API key (stored locally; leave blank to keep the saved key)',
 '正在检查连接配置…':'Checking connection…','生成质量':'Quality','低（更快，适合试稿）':'Low (faster, for drafts)','中':'Medium','高':'High',
 'Prompt（可编辑）':'Prompt','描述所需图片的主体、场景和风格':'Describe the subject, scene and style','读取本页内容到 Prompt（先审阅）':'Use slide content as prompt','生成一张':'Generate image',
 '取消任务':'Cancel task','取消本次任务':'Cancel this task','预览并裁切':'Preview & crop','图片处理进度':'Image processing progress',
 '排队中':'Queued','处理中':'Processing','待裁切确认':'Ready to crop','等待空闲任务名额':'Waiting for a worker',
 '正在等待图片模型返回，无法获得真实百分比':'Waiting for the image model; exact progress is unavailable','正在下载并检查图片':'Downloading and checking image',
 '任务已排队，可关闭窗口继续编辑其他页。':'Queued. You can close this dialog and edit other slides.',
 '正在等待图片模型，可取消本地等待。':'Waiting for the image model. You can cancel the local wait.',
 '正在读取图片，成功后进入裁切。':'Loading image; cropping opens when ready.',
 '图片已就绪，确认裁切后才会替换原图。':'Image ready. Confirm the crop to replace the original.',
 '处理失败，原图片未修改。可重试、使用浏览器通道或本地上传。':'Failed. The original image is unchanged. Retry, use the browser channel or upload locally.',
 '已取消，原图片未修改，可重新导入。':'Cancelled. The original image is unchanged. You can import again.',
 '图片不能超过 15 MB':'Image must be 15 MB or smaller','浏览器读取成功，请确认裁切':'Image downloaded. Confirm the crop.',
 '正在检查链接；随后通过浏览器自身网络读取，不携带登录凭据':'Checking the URL before downloading in the browser without sign-in credentials',
 '浏览器正在读取图片…':'Downloading image in browser…',
 '链接没有返回 PNG / JPEG / WebP 原图，请保存原图后本地上传':'The link did not return a PNG / JPEG / WebP image. Save the original and upload it.',
 '裁切图片':'Crop image','确认裁切':'Confirm crop','取消裁切':'Cancel crop','缩放图片':'Zoom image','重置裁切':'Reset crop','确认并使用':'Use image',
 'ICON 设置':'Icon settings','离线匹配':'Offline matching','当前显示':'Visible','显示本页 ICON':'Show icons on this slide','全部恢复自动匹配':'Reset all to automatic',
 '显示此 ICON':'Show icon','恢复自动':'Automatic','恢复自动匹配':'Automatic matching','深灰':'Dark gray','华为红':'Huawei red','黑色':'Black',
 '语义不明确，采用中性支撑图标，可手动替换':'Using a neutral icon; replace it if needed','手动选择，已锁定':'Manual selection · Locked',
 '手动选择后锁定，不会被自动匹配覆盖。':'Manual selections are locked and will not be replaced automatically.',
 '搜索ICON':'Search icons','搜索中文类别或英文名称，例如 储能 / battery':'Search icons, e.g. battery',
 '没有匹配的本地图标，请尝试业务类别或英文名称。':'No matching local icons. Try a category or English name.',
 '此版式没有业务 ICON 槽位。请选择标有“含 N 个 ICON”的版式；已锁定的图标选择会随内容快照保留。':'This layout has no icon slots. Choose an icon layout. Locked selections are preserved in snapshots.',
 '恢复本页所有 ICON 的自动匹配？此操作可以撤销。':'Reset all icons on this slide to automatic matching? You can undo this.',
 '团队':'Team','合作':'Collaboration','云服务':'Cloud','芯片算力':'Compute','服务器':'Server','数据':'Data','电池储能':'Battery storage','光伏':'Solar','风电':'Wind',
 '交付运输':'Delivery','航运':'Shipping','安全保障':'Security','风险提示':'Risk','成本资金':'Cost','金融政策':'Finance & policy','目标':'Target','增长趋势':'Growth','经营分析':'Business analytics',
 '验收检查':'Acceptance','实施路径':'Roadmap','研究诊断':'Research','优化配置':'Optimization','行动清单':'Actions','里程碑':'Milestone','保密权限':'Access control','网络连接':'Network',
 '创新洞察':'Innovation','全球市场':'Global markets','衔接关联':'Connection','交换协同':'Exchange','材料报告':'Report','计划日程':'Schedule','效率时间':'Efficiency','绿色低碳':'Sustainability',
 '生产制造':'Manufacturing','供应链产品':'Supply chain','权衡比较':'Trade-offs','电力能源':'Power','燃油':'Fuel','支撑能力':'Capability','知识标准':'Knowledge','工具工程':'Engineering','结构份额':'Share','监测反馈':'Monitoring','数字化系统':'Digital systems',
 '图表数据':'Chart data','图表显示':'Chart display','图表':'Chart','恢复本组':'Reset group','＋ 数据项':'+ Data item','+ 数据项':'+ Data item',
 '坐标轴刻度':'Axis ticks','显示坐标轴刻度':'Show axis ticks','数据标签':'Value labels','显示数值':'Show values','显示数据值':'Show values','相对比例（自动）':'Relative scale (automatic)','固定 0–100':'Fixed 0–100','比例':'Scale','呈现比例':'Scale',
 '柱状图':'Column chart','折线图':'Line chart','＋行':'+ Row','－行':'− Row','＋列':'+ Column','－列':'− Column','查找当前页':'Find on this slide','查找当前页组件':'Find slide components','查找文字或组件':'Find text or components','查找 ICON':'Find icon',
 '任务工作区 ▾':'Task workspace ▾','AI 版式任务工作区':'AI layout task workspace','并发':'Concurrency','任务并发数':'Concurrent tasks','新任务等待上限':'New task timeout','沿用原执行器':'Use original executor',
 '暂停所选':'Pause selected','继续暂停项':'Resume paused','取消所选':'Cancel selected','删除所选':'Delete selected','导出 LOG':'Export log','页面 / 目标版式':'Slide / Target layout',
 '状态与阶段':'Status / Stage','耗时 / 最近信号':'Elapsed / Last signal','排序 / 操作':'Order / Actions','选择全部任务':'Select all tasks',
 '任务 LOG':'Task log','一键复制':'Copy log','导出 JSON':'Export JSON','当前任务日志':'Original task log','已复制当前任务 LOG':'Task log copied','已发起当前任务 JSON 下载':'Task log download started',
 '保留阶段、耗时、最后信号和错误代码；不记录密钥、提示词或模型正文。':'Includes stages, duration, last signal and error codes. Excludes credentials, prompts and model responses.',
 '单次 AI 调用等待上限':'AI call timeout','暂停后可修改；继续时重新执行安全步骤。排队、渲染和校验另计。':'Pause to change the timeout. Resume reruns safe steps. Queueing, rendering and validation are timed separately.',
 '本任务等待秒数':'Task timeout in seconds','秒（1–600）':'seconds (1–600)','保存上限':'Save timeout','等待上限':'Timeout',
 '排队':'Queued','执行中':'Running','已暂停':'Paused','待确认':'Review required','待应用':'Ready','已完成':'Completed','已取消':'Cancelled','失败':'Failed','已拒绝':'Rejected','编辑冲突':'Edit conflict',
 '暂停':'Pause','继续':'Resume','重新尝试':'Retry','审阅候选':'Review candidate','查看 / 应用':'Review / Apply','未收到宿主信号':'No host signal','等待 AI 响应':'Waiting for AI',
 '已应用并保存，可通过演示控制台撤销':'Applied and saved. Undo is available.',
 '暂无任务。可在不同页面独立提交；候选待确认不占并发名额。':'No tasks. Submit independently on different slides. Candidates awaiting review do not occupy workers.',
 '删除任务和 LOG，不影响页面':'Delete task and log; leave the slide unchanged',
 '已完成或已停止的暂停、失败/冲突或取消任务可删除；运行中不能删除':'Completed tasks and stopped paused, failed, conflicted or cancelled tasks can be deleted. Running tasks cannot be deleted.',
 '删除任务记录及其 LOG，不能恢复；不修改任何 PPT 页面、已保存内容或脑图。建议先导出需要保留的 LOG。':'Task records and logs will be permanently deleted. Slides, saved content and the mind map are unchanged. Export any logs you need first.',
 '确认删除':'Delete permanently','任务操作失败':'Task operation failed','请刷新页面后重新尝试':'Refresh the page and retry',
 'Agent 连接设置':'Agent connection','正在检查 Agent 连接…':'Checking Agent connection…','连接环境':'Agent environment','高级设置：入口与模型':'Advanced: executable & model','公司 JSON Worker':'Company JSON worker',
 '可执行文件的绝对路径（留空只查找所选 Agent）':'Executable path (leave blank to find the selected Agent)',
 '模型（留空沿用宿主设置）':'Model (leave blank to use the host setting)',
 '我确认只为此预览切换到不同的 Agent':'Switch to a different Agent for this preview only',
 '已找到入口；实际登录、网络和模型结果需在你明确执行后验证。':'Executable found. Sign-in, network and model output will be verified only when you start a task.',
 '保存连接（不调用模型）':'Save connection (no model call)',
 '连接已保存，已找到入口；本次未调用模型。':'Connection saved and executable found. No model was called.',
 '入口检查通过；只有点击开始后才会实际调用模型。':'Connection check passed. The model is called only after you click Start.',
 'Agent 尚未连接；请先配置，不会加入失败任务。':'Agent not connected. Configure it before submitting a task.',
 '请先连接原生成 Agent；当前不会提交任务。':'Connect the original Agent first. No task has been submitted.',
 'AI 适配需要 HTTP 预览服务；离线编辑不受影响。':'AI adaptation requires the HTTP preview service. Offline editing is unaffected.',
 '当前没有配置可用的原项目模型服务。请先配置，或选择已连接的 Agent。':'No model service is configured for this project. Configure one or select the connected Agent.',
 '只作用于本演示的原项目，不改宿主全局配置，不复制登录凭据。保存只检查入口，不调用模型。':'Applies to this project only. Global host settings and credentials are unchanged. Saving checks the executable without calling a model.',
 '只作用于当前独立预览，不改宿主全局配置，不复制登录凭据。保存只检查入口，不调用模型。':'Applies to this preview only. Global host settings and credentials are unchanged. Saving checks the executable without calling a model.',
 '此页暂无可切换版式':'No alternative layouts available','正在读取可用版式…':'Loading layouts…','重新读取版式':'Reload layouts','原始版式 / 历史版本':'Original layout / History','选择页面快照':'Page snapshot','恢复方式':'Restore mode',
 '仅换回版式，保留当前内容':'Restore layout, keep current content','恢复当时整个页面（版式＋当时内容）':'Restore the complete snapshot (layout and content)',
 '我已确认恢复方式。先看候选，确认后才替换本页；支持撤销。':'I confirm the restore mode. Review the candidate before applying. Undo is available.',
 '生成恢复预览（不调用 AI）':'Preview restore (no AI)','暂无可恢复的版本。':'No saved versions available.',
 '只换回所选版式，当前完整内容保留。仍会进行容量与页面实测检查。':'Restores the selected layout while retaining current content. Capacity and browser checks still apply.',
 '将恢复所选快照的版式及当时内容，会替换本页当前文字、数据和图片。当前页先保留快照，应用后可撤销。':'Restores the snapshot layout and content, replacing this slide’s current text, data and images. A snapshot is retained for undo.',
 '隐藏提示':'Dismiss','查看记录与处理建议':'View record & recovery options','读取当前页并重新尝试':'Retry with current slide','当前页换版':'Layout change','AI 内容适配':'AI content adaptation','查看内容与版式候选':'Review content & layout candidate',
 '其他页面可独立提交任务；底部可批量管理。':'Other slides can submit independently. Manage tasks below.',
 '此记录不代表当前页面仍有故障。重新尝试会读取当前页并重新检查目标版式；需要 AI 时先确认。':'This is a historical record, not a current slide error. Retry reads the current slide and checks the target layout. AI use requires confirmation.',
 '真实版式预览':'Layout preview','待确认版式预览':'Candidate layout preview','处理前（完整原稿）':'Before (complete original)','处理后（待确认）':'After (review required)','查看原内容块的去向映射':'View content mapping','重复数字的出现次数变化':'Changes in repeated-number counts',
 '确认内容、分组与样式调整并应用':'Approve content, grouping & style changes','拒绝候选，保留原页':'Reject and keep original','稍后审阅':'Review later','确认手动修改并应用':'Apply manual changes',
 '确认前不改当前页，其他任务继续运行。改写字段采用新版式样式；可撤销。预览适配不自动回写脑图原稿。':'The current slide stays unchanged until approval. Other tasks continue. Adapted fields use the new layout style. Undo is available. The mind map is not overwritten.',
 '暂未切换布局':'Layout not changed','原页面及全部内容未改变。':'The original slide and all its content are unchanged.','错误代码':'Error code','继续 / 重试':'Resume / Retry','本页内容':'Slide content','布局档位':'Content slots','呈现样式':'Presentation style','重点内容（0=不突出）':'Emphasis (0 = none)',
 '页面观点标题':'Slide assertion','页面结论':'Conclusion','引导语':'Introduction','块标题':'Block title','真实数值':'Actual value','证据 / 来源':'Evidence / Source','保存草稿':'Save draft','撤销草稿':'Undo draft','重做草稿':'Redo draft','保留草稿并关闭':'Keep draft & close','从空白填写目标布局':'Start with empty target','重新沿用原内容':'Reuse original content',
 '请先在幻灯片中选择文字':'Select text on the slide first','恢复主题文字颜色':'Reset to theme text color','打开图表数据编辑':'Edit chart data','返回页面设置':'Back to slide settings','当前页面没有可编辑的数据图表。':'No editable charts on this slide.','所选文字':'Selected text','拖动边框移动；使用四个手柄缩放':'Drag the outline to move; drag handles to resize',
 '数值比例':'Value scale','数据数值':'Data values','显示数据数值':'Show data values','坐标从 0 起算，保留真实数值和单位':'The axis starts at zero. Actual values and units are preserved.',
 '应用图表数据':'Apply chart data','取消数据草稿':'Discard data draft','原图数据已改变，请取消草稿后重新编辑。':'The chart data has changed. Discard this draft and edit again.',
 '拖动图片调整位置，使用滑块缩放后确认。':'Drag to reposition. Adjust zoom, then confirm.','缩小':'Zoom out','放大':'Zoom in','图片缩放':'Image zoom','使用此裁切':'Use this crop',
 '版式切换说明':'About layout switching','选择版式直接换版；AI 适配需确认后执行。支持撤销和重做。':'Select a layout to switch. AI adaptation requires confirmation. Undo and redo are available.',
 '候选待确认':'Review required','正在保存版式，请稍后刷新…':'Saving layout. Wait before refreshing…','版式已保存':'Layout saved','HTTP 预览模式支持版式任务。':'Layout tasks require HTTP preview mode.',
 '仅锁定此页，其他页可继续适配。':'Only this slide is locked. Other slides can still be adapted.',
 '开始前请了解：AI 适配可能耗时较长，也可能失败':'Before starting: AI adaptation can take several minutes and may fail',
 '可能需要数分钟；等待上限不是完成时间承诺。超时、内容超容、事实/来源或页面检查不通过，都可能导致失败。':'This may take several minutes. The timeout is not a completion estimate. Timeouts, capacity limits, fact/source checks or page validation can cause failure.',
 '只生成候选，确认前不替换原页。失败或取消保留当前页；已发生的模型调用仍可能消耗用量。':'A candidate is generated; the original is replaced only after approval. Failure or cancellation preserves the slide. Model calls already made may still incur usage.',
 '可在底部任务工作区暂停或取消。暂停会结束本轮调用，继续可能重新调用，并非从原进度断点恢复。等待期间可操作其他页面；修改本页会使旧候选失效。':'Pause or cancel in the task workspace below. Pausing ends the current call; resuming may start a new call. You can edit other slides while waiting. Editing this slide invalidates its old candidate.',
 '若只想快速调整外观，优先查看“原文直接换版”：不调用 AI、不改写内容，仍需通过页面校验。':'For a quick visual change, try Keep content layouts first. They do not call AI or rewrite content, but still require page validation.',
 '返回查看原文换版选项':'Back to keep-content layouts',
 '只生成待审阅候选。数字、来源和原块去向受保护；每页任务独立，可同时处理其他页。':'Generates a candidate for review. Numbers, sources and content mapping are protected. Tasks are independent across slides.',
 '目标为表格版式，需要将现有内容组织为表格行，不会补造数据或事实。':'The target is a table. Existing content will be organized into rows without inventing data or facts.',
 '同意将当前正文整理为表格结构（候选仍需审阅确认）':'Allow restructuring into a table (candidate review required)',
 '当前关系不能直接放入目标版式。候选将调整关系的呈现方式，保留原意；需逐条审阅后才应用。':'The current relationships do not fit the target directly. The candidate will propose a different representation while preserving meaning. Review each change before applying.',
 '允许提出关系表达调整（不删除原有先后、因果或层级含义）':'Allow relationship proposals (preserve sequence, causality and hierarchy)',
 '允许提出重新分组':'Allow regrouping proposals','补充要求':'Additional requirements','执行方式':'Executor','原项目 Agent 桥接':'Original project Agent bridge','原项目已配置模型服务':'Project model service',
 '本次推理强度':'Reasoning for this call','沿用原宿主':'Use host setting','轻量（适合局部适配）':'Low (for local adaptation)','深度':'High','仅本次调用，不改全局设置。':'This call only; global settings are unchanged.',
 '本次 AI 等待上限（秒）':'AI timeout for this call (seconds)','上限不包含排队时间；并发过高可能触发模型限流。':'Excludes queueing. High concurrency may trigger model rate limits.',
 '了解风险，加入队列生成候选':'Acknowledge & queue candidate','请检查原项目执行器':'Check the original project executor',
 '请设置 1–600 秒的单轮等待上限；最多调用 2 轮，排队、渲染与校验时间另计。':'Set a per-call timeout of 1–600 seconds. Up to two calls; queueing, rendering and validation are timed separately.',
 '请先确认恢复方式，未修改页面。':'Confirm the restore mode first. The slide is unchanged.',
 '请先明确同意整理为表格结构，或取消后选择其他版式':'Approve restructuring into a table, or cancel and choose another layout.',
 '请先确认关系表达调整，或选择原文兼容版式；未调用模型':'Approve relationship changes, or select a compatible keep-content layout. No model was called.',
 '本页已有未完成任务，请先完成或取消。':'Finish or cancel this slide’s current task first.',
 '页面已切换，请从目标页重新打开。':'The slide changed. Reopen this action on the target slide.',
 '本页已有新编辑，请重新打开后操作；原页未改变。':'The slide has new edits. Reopen this action. The original is unchanged.',
 '此版式没有业务 ICON 槽位。':'This layout has no business icon slots.',
 '数据项':'Data item','原始快照独立保留，不受当前推荐版式过滤。':'The original snapshot is retained independently of layout recommendations.',
 '未找到原宿主图片配置，请使用独立配置':'Host image configuration not found. Configure a service manually.',
 '已在本机读取本页可见文字，请审阅并删除敏感内容。尚未发送给模型。':'Slide text loaded locally. Review and remove sensitive content before sending. Nothing has been sent to the model.',
 '请先开启 AI 生图，再点击生成':'Enable AI image generation first.',
 '此图片框正在处理；请等待结果或取消后重试':'This image slot is processing. Wait for the result, or cancel before retrying.',
 '页面已改变，请重新选择图片框':'The page has changed. Select the image slot again.',
 '未找到可用凭据。请检查 Harness 的 API Key 环境变量，或选择独立配置。':'No usable credentials found. Check the host API key configuration or configure a service manually.',
 '链接导入和 AI 生图需要 HTTP 预览模式；本地上传仍可使用':'URL import and AI generation require HTTP preview mode. Local upload is still available.',
 '原页面已移除，未替换任何图片':'The original slide was removed. No image was replaced.',
 '原图片框已关闭或版式已改变，请先恢复对应图片框':'The original image slot was hidden or its layout changed. Restore the slot first.',
 '此图片框可能已发生修改。是否将候选图用于当前图片框？确认裁切后才会替换。':'This slot may have changed. Use the candidate in the current slot? It is replaced only after you confirm the crop.',
 '浏览器未允许复制，请手动选中日志或使用“导出 JSON”。':'Clipboard access was denied. Select the log manually or use Export JSON.',
 '只能删除已完成或已停止的暂停、失败/冲突或取消任务。运行、排队、待确认与待应用任务不能删除；刚暂停的任务请等待后台退出。':'Completed tasks and stopped paused, failed, conflicted or cancelled tasks can be deleted. Running, queued, pending-review and ready-to-apply tasks cannot be deleted. Wait for a paused worker to exit.',
 '请勾选支持此操作的任务':'Select tasks that support this action.',
 '单页版式':'Page layout','打开单页版式':'Choose page layout','打开当前页完整排版模板选择':'Choose a layout for this slide','展开控制面板并选择单页版式':'Open controls and choose a page layout',
 '并列观点卡片':'Parallel point cards','流程因果链':'Process / causal chain','对比分析':'Comparison','层级支撑':'Hierarchical support','自由关系':'Free relationships',
 '咨询式条目 · 无卡片框':'Consulting list · Frameless','双栏简报 · 无卡片框':'Two-column brief · Frameless','重点聚焦 · 主次分区':'Focus · Primary and supporting areas','弹性 Bento · 高密度并列观点':'Flexible Bento · Dense parallel points',
 '数据条形比较':'Bar comparison','数据柱形趋势':'Column trend','数据占比结构':'Share structure','数据贡献瀑布':'Contribution waterfall',
 '能力支柱':'Capability pillars','图标要点清单':'Icon key points','分类风险分析':'Risk categories','图标实施步骤':'Icon implementation steps','阶段演进路线图':'Stage roadmap','图文重点维度':'Media-led key dimensions',
 '布局档位 · 表格行容量':'Table row capacity','重点内容（0＝不突出）':'Emphasis (0 = none)','卡片':'Cards','箭头链':'Chevron chain','价值链':'Value chain',
 '按顺序显示 0–3 张案例图片；未显示图片的卡片自动使用品牌纹理。':'Show 0–3 case images in order. Cards without images use the brand texture.',
 '背景光晕与底部热力条等纯装饰元素的显隐。':'Show or hide purely decorative elements such as background glows and bottom heat strips.',
 '批量继续只处理暂停任务；历史失败项请逐条重新尝试，以重新核对当前内容和 AI 确认。':'Batch resume only resumes paused tasks. Retry failed tasks individually to recheck current content and AI approval.',
 '已继续暂停项；历史失败项请逐条重新尝试，不自动重发旧内容。':'Paused tasks resumed. Retry failed tasks individually; old content is not resubmitted automatically.',
};

export const CONSOLE_PATTERNS_EN = [
 [/^第\s*(\d+)\s*页$/, 'Slide $1'],[/^(\d+)\s*分钟$/, '$1 minutes'],[/^(\d+)\s*秒$/, '$1 s'],
 [/^(\d+) 个未结束 · (\d+)\/(\d+) 个执行名额$/, '$1 unfinished · $2/$3 workers'],
 [/^(.+) · 第 (\d+) 次执行(?: · 队列 (\d+))?$/,(_,name,n,q)=>`${name} · Attempt ${n}${q?' · Queue '+q:''}`],
 [/^(历史 · )?(排队|执行中|已暂停|待确认|待应用|已完成|已取消|失败|已拒绝|编辑冲突) · (\d+)%$/,(_,h,s,n)=>`${h?'History · ':''}${CONSOLE_EN[s]} · ${n}%`],
 [/^(\d+) 秒(?: \/ AI 上限 (\d+) 秒)?$/,(_,s,t)=>`${s} s${t?' / AI limit '+t+' s':''}`],
 [/^最近宿主输出 (\d+) 秒前(.*)$/, '$1 s since last host output$2'],[/^最近更新 (\d+) 秒前(.*)$/, 'Updated $1 s ago$2'],
 [/^Agent[：:]\s*(.*?) · 已找到入口（尚未调用模型）$/, 'Agent: $1 · Connected (no model call)'],
 [/^\/?\s*(\d+) 个 ICON，无需调用模型。$/, '/ $1 icons · No model call'],
 [/^大小 · 当前 (\d+)px$/, 'Size · $1 px'],
 [/^根据(标题|正文)中的“(.*?)”匹配(。手动选择后锁定，不会被自动匹配覆盖。)?$/,(_,field,term,end)=>`Matched ${field==='标题'?'title':'body'} term “${term}”${end?'. Manual selections stay locked.':''}`],
 [/^替换 ICON · (.+)$/, 'Replace icon · $1'],
 [/^(.+) ICON 大小[：:]\s*(\d+)px$/, '$1 icon size: $2 px'],[/^(.+) ICON 大小$/, '$1 icon size'],
 [/^(.+) ICON 颜色[：:]\s*(深灰|华为红|黑色)$/,(_,name,c)=>`${name} icon color: ${CONSOLE_EN[c]}`],[/^(.+) ICON 颜色$/, '$1 icon color'],
 [/^替换 (.+) 的 ICON$/, 'Replace icon for $1'],
 [/^(新增)?图片 (\d+)( · 选择来源(?: ↗)?)?$/,(_,extra,n,source)=>`${extra?'Added image':'Image'} ${n}${source?' · Choose source ↗':''}`],
 [/^当前图片框比例 ([\d.]+) : 1。所有来源均进入同一裁切流程；不拉伸图片，确认后可撤销\/重做。$/, 'Frame ratio $1 : 1. Crop before applying. Images are not stretched; undo/redo is available.'],
 [/^图片 (\d+) · (排队中|处理中|待裁切确认|失败|已取消) · (\d+) 秒$/,(_,n,s,t)=>`Image ${n} · ${CONSOLE_EN[s]} · ${t} s`],
 [/^已读取 (\d+) KB$/, '$1 KB downloaded'],
 [/^数据项\s*[·：]?\s*(\d+)\s*[·：]\s*(标签|数值)$/,(_,n,k)=>`Item ${n} · ${CONSOLE_EN[k]}`],
 [/^第\s*(\d+)\s*项(标签|数值)$/,(_,n,k)=>`Item ${n} ${CONSOLE_EN[k].toLowerCase()}`],
 [/^第(\d+)行第(\d+)列$/, 'Row $1, column $2'],
 [/^选择第 (\d+) 页任务$/, 'Select task for slide $1'],
 [/^确认删除 (\d+) 个任务？$/, 'Permanently delete $1 tasks?'],
 [/^已删除 (\d+) 个任务，页面内容未修改。$/, 'Deleted $1 tasks. Slides are unchanged.'],
 [/^上次任务：(排队|执行中|已暂停|待确认|待应用|已完成|已取消|失败|已拒绝|编辑冲突)（历史记录）$/,(_,s)=>`Last task: ${CONSOLE_EN[s]} (history)`],
 [/^(当前页换版|AI 内容适配) · (排队|执行中|已暂停|待确认|待应用|已完成|已取消|失败|已拒绝|编辑冲突) · (\d+)%$/,(_,k,s,n)=>`${CONSOLE_EN[k]} · ${CONSOLE_EN[s]} · ${n}%`],
 [/^错误代码[：:]\s*(.+)$/, 'Error code: $1'],
 [/^图片 \{n\}$/, 'Image {n}'],
 [/^按目标版式处理内容 · (.+)$/, 'Adapt content to layout · $1'],
 [/^目标 ([\d /]+) 组；当前 (\d+) 组。$/, 'Target: $1 groups · Current: $2 groups'],
 [/^已找到原执行器：(.*)$/, 'Original executor found: $1'],
 [/^本次每轮 AI 等待上限 (\d+) 秒；检查不通过时最多自动修订 1 次（共 2 轮），两轮调用等待合计最多 (\d+) 秒，另加排队、渲染与校验时间。$/, 'Per-call AI timeout: $1 s. One automatic revision is allowed (two calls total), up to $2 s plus queueing, rendering and validation.'],
 [/^第 (\d+) 页(适配候选|手动编辑候选|恢复版式候选|整块删除与重排候选) · (.+)$/,(_,n,k,name)=>`Slide ${n} · ${{适配候选:'Adaptation candidate',手动编辑候选:'Manual edit candidate',恢复版式候选:'Restore candidate',整块删除与重排候选:'Deletion & reflow candidate'}[k]} · ${name}`],
 [/^内容块 (\d+) → (\d+)；关系 (.*) → (.*)。$/, 'Blocks $1 → $2; relationships $3 → $4.'],
 [/^支持 (\d+)[–-](\d+) 项$/, 'Supports $1–$2 items'],[/^最少 (\d+) 项$/, 'Minimum $1 items'],[/^删除第 (\d+) 个数据项$/, 'Delete data item $1'],
 [/^合计 ([\d.]+)% \/ 100%$/, 'Total $1% / 100%'],
 [/^【(原始|历史)】(.*)$/,(_,kind,rest)=>`[${kind==='原始'?'Original':'History'}]${rest}`],
 [/^数据项 · (\d+) · (Label|Value|标签|数值)$/,(_,n,k)=>`Item ${n} · ${CONSOLE_EN[k]||k}`],
 [/^(.+) ICON 大小：(.+)$/, '$1 icon size: $2'],
 [/^(\d+) 步$/, '$1 steps'],[/^(\d+) 个$/, '$1 items'],[/^最多 (\d+) 行$/, 'Up to $1 rows'],
];

export function translateConsoleText(value,base){
 if(typeof value!=='string'||!value.trim())return value;
 const text=value.trim();let translated=CONSOLE_EN[text]||base?.(text)||text;
 if(translated===text)for(const [pattern,replacement] of CONSOLE_PATTERNS_EN){if(pattern.test(text)){translated=text.replace(pattern,replacement);break;}}
 return translated===text?value:value.replace(text,translated);
}

export function installConsoleI18n(win){
 if(!win?.document||!win.__deckI18n||win.__consoleI18n)return;
 const doc=win.document,i18n=win.__deckI18n,oldUi=i18n.ui.bind(i18n),oldMeta=i18n.meta.bind(i18n);
 const translate=text=>i18n.isEn?translateConsoleText(text,t=>{const v=oldUi(t);return v!==t?v:oldMeta(t);}):text;
 i18n.ui=(text,params)=>{let out=translate(oldUi(text,params));if(params&&typeof out==='string')out=out.replace(/\{(\w+)\}/g,(m,k)=>k in params?String(params[k]):m);return out;};
 const scope='#deck-topbar,#slide-rail,#deck-page-pager,#preview-layout-quick,#preview-panel-collapse,#preview-panel,#layout-task-pane,dialog,.dashi-image-cropper,#console-insert-wrap,#export-http-modal,#export-overlay';
 const excluded='#deck,#slide-rail-list,#preview-lang-toggle,.preview-author,[data-i18n-ignore],pre,script,style,textarea,[contenteditable=true],[data-find-results],.bi-preview b';
 const attrs=['title','aria-label','placeholder','alt','data-color-label','label'];
 const openSelects=new WeakSet(),menuOpen=el=>{const select=el.closest('select');return select&&openSelects.has(select);};
 const eligible=el=>el?.closest(scope)&&!el.closest(excluded);
 const userText=node=>node.parentElement?.matches('td')&&node.parentElement.querySelector(':scope>[data-go]');
 const nodeText=node=>node.nodeValue.trim()==='高'&&node.parentElement.matches('label')?node.nodeValue.replace('高','Height'):translate(node.nodeValue);
 function translateElement(el){
  if(!eligible(el))return;
  // Native selects must retain their option nodes while the menu is open.
  if(menuOpen(el))return;
  for(const a of attrs){const v=el.getAttribute(a);if(v){const next=translate(v);if(next!==v)el.setAttribute(a,next);}}
 }
 function refresh(root=doc.body){
  if(!i18n.isEn||!root)return;
  if(root.nodeType===3){const el=root.parentElement;if(eligible(el)&&!userText(root)&&!menuOpen(el)){const next=nodeText(root);if(next!==root.nodeValue)root.nodeValue=next;}return;}
  if(root.nodeType!==1)return;
  translateElement(root);
  const walker=doc.createTreeWalker(root,win.NodeFilter.SHOW_ELEMENT|win.NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===1)translateElement(node);else{const el=node.parentElement;if(eligible(el)&&!userText(node)&&!menuOpen(el)){const next=nodeText(node);if(next!==node.nodeValue)node.nodeValue=next;}}}
 }
 let scheduled=false;const pending=new Set();
 const queue=root=>{if(!root)return;pending.add(root);if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;const roots=[...pending];pending.clear();for(const root of roots)if(root.isConnected)refresh(root);});};
 if(i18n.isEn){
  const observer=new win.MutationObserver(records=>{for(const r of records){if(r.type==='characterData'||r.type==='attributes')queue(r.target);else for(const node of r.addedNodes)queue(node);}});
  observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
  doc.addEventListener('pointerdown',event=>{if(event.target.matches('select'))openSelects.add(event.target);},true);
  doc.addEventListener('keydown',event=>{if(!event.target.matches('select'))return;if(['ArrowDown','ArrowUp','F4',' '].includes(event.key))openSelects.add(event.target);if(event.key==='Escape'){openSelects.delete(event.target);setTimeout(()=>refresh(event.target),0);}},true);
  for(const name of ['focusout','change'])doc.addEventListener(name,event=>{if(event.target.matches('select')){openSelects.delete(event.target);setTimeout(()=>refresh(event.target),0);}});
  for(const method of ['alert','confirm','prompt']){const original=win[method].bind(win);win[method]=(message,...rest)=>original(translate(message),...rest);}
  refresh();
 }
 win.__consoleI18n={translate,refresh};
}
if(typeof window!=='undefined')installConsoleI18n(window);

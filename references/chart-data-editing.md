# 图表项数与编辑

初次分析内容、生成脑图之前读取本文件。使用 `inspect --layout <key>` 返回的 `dataSeries` / `fillPlan.dataSeries`，与当前实际数据做匹配；数据项数量、标签长度、数值域、占比合计和单位须同时满足。脑图初稿容量报告的 `chartBoundaries` 与 `chartPlan` 保存可用类型、项数范围及已匹配版式。确认和生成前重新检查，不以脑图最初的计划锁死最终版式。

超出范围时保留全部原始数据，提出完整数据分组/拆图或表格方案让用户确认；不截断、补零、取绝对值、自动归一化，也不通过改写坐标域伪装成匹配。HW 横条原稿高度只能安全放 2–5 项，不能再沿用旧的 8 项声明。HW 柱/条/折线/面积默认使用从 0 起算的自动数值范围，允许非负真实业务尺度；仅调整几何映射，不归一化或改写数据。可手动切换固定 0–100，超过该范围时拒绝切换。雷达固定四维且真实值为 0–100；其显示范围同样可选择自动或固定。原生柱、条和瀑布允许合法负值。标签安全长度还会随数据项数/图表空间变化，不能只看项数上限；以实际 props 的共享校验和浏览器检查为准，不缩字号解决密集标签。

## 演示控制台

HW 图表在“图表数据 → 图表显示”提供独立的“坐标轴刻度”“数据数值”开关，以及“相对比例（自动范围）/固定范围（0–100）”。自动范围始终包含零，不截断纵轴、不取绝对值、不把显示缩放写回数据。数值标签显示原始数值，刻度显示当前真实单位下的数值。环形图无坐标轴与比例选项，仅切换数值；真实占比仍须合计 100%。默认自动范围、刻度和数值开启。开关和比例调整支持撤销/重做、保存刷新及 PPTX/PDF 导出，不修改独立解读内容槽。旧预览需要受控更新运行时才能获得这些控件。

进入“图表数据”，每组显示项数、添加和逐项删除。达到最少/最多时禁用对应操作，固定业务语义的数据组禁用增删并在 tooltip 说明。新增项的标签为“待补充”，数值留空；先填写真实数值后“应用图表数据”。增删在草稿中完成，“取消数据草稿”保留原图。占比图可一次编辑多项至合计 100%，不自动修改其他值。删除明确提示后果；应用后接入现有撤销/重做、自动保存、刷新和导出。

数据项与解读槽独立：HW 的 `chart.items` 变化不修改 `cards`、`variant`、图形坐标、来源、ICON 和媒体；原生图表只修改 `items`，不改 `analysis` 及其排版。旧主题只同步该数据组专属的可见项数控件，不改变其他内容区。普通数值修改仍即时更新；涉及增删或占比约束时采用一次应用的可撤销事务。旧网页须受控更新运行时，不假定替换 Skill 会自动更新旧稿。

## 全部已注册数据组

固定项数用于四维雷达、完整月度/季度序列、与区域索引绑定的数据、固定业务构成；不会为提供增删按钮而改变已批准构图或业务语义。普通指标内容卡不是额外图表数据项，仍按内容槽规则编辑。

| 版式 | 键 / 数据组 | 数据项数 | 数值/固定原因 |
| --- | --- | --- | --- |
| 摘要 Overview | `theme17_page006` · `tracks` | 2–5 | 非负，合计 100% |
| 热力 Heatmap | `theme17_page010` · `months` | 12（固定） | 原稿固定时间范围或固定业务构成 |
| 排名 Ranking | `theme17_page011` · `companies` | 5–10 | 非负 |
| 气泡 Deal Map | `theme17_page017` · `bands` | 2–4 | 非负 |
| 季度 Q1 冷启动 | `theme17_page018` · `months` | 3（固定） | 原稿固定时间范围或固定业务构成 |
| 季度 Q1 冷启动 | `theme17_page018` · `context` | 4（固定） | 原稿固定时间范围或固定业务构成 |
| 季度 Q3 峰值 | `theme17_page020` · `months` | 12（固定） | 原稿固定时间范围或固定业务构成 |
| 季度 Q4 回落 | `theme17_page021` · `nodes` | 2–4 | 非负 |
| 峰谷 Peak/Trough | `theme17_page022` · `months` | 6–12 | 非负 |
| 瀑布 Waterfall | `theme17_page023` · `steps` | 3–5 | 非负 |
| 区间 Deal Size | `theme17_page024` · `rows` | 1–4 | 非负 |
| 排名 Active Capital | `theme17_page027` · `rows` | 4–7 | 非负 |
| 集中度 Concentration | `theme17_page028` · `tiers` | 2–3 | 非负 |
| 赛道 法律 AI | `theme17_page031` · `rows` | 3–5 | 非负 |
| 赛道 医疗 AI | `theme17_page032` · `branches` | 2–3 | 非负 |
| 赛道 金融 AI | `theme17_page033` · `segments` | 2–4 | 非负，合计 100% |
| 赛道 算力云 | `theme17_page034` · `split` | 2–3 | 非负，合计 100% |
| 赛道 具身智能 | `theme17_page036` · `segments` | 2–3 | 非负 |
| 赛道 自动驾驶 | `theme17_page037` · `segments` | 2–3 | 非负 |
| 赛道 AI 安全 | `theme17_page038` · `layers` | 2–4 | 非负 |
| 赛道 内容生成 | `theme17_page039` · `segments` | 2–4 | 非负 |
| 赛道 教育 AI | `theme17_page040` · `segments` | 2–3 | 非负 |
| 赛道 销售营销 | `theme17_page042` · `segments` | 2–3 | 非负 |
| 赛道 模型对齐 | `theme17_page045` · `segments` | 2–3 | 非负 |
| 结构 未披露轮次 | `theme17_page048` · `components` | 2–4 | 非负，合计 100% |
| 构成 Investor Mix | `theme17_page049` · `segments` | 2–4 | 非负，合计 100% |
| 联盟 云厂商 | `theme17_page051` · `providers` | 2–4 | 非负 |
| 生态 NVIDIA | `theme17_page052` · `nodes` | 2–4 | 非负 |
| 集群 区域对比 | `theme17_page054` · `share` | 5（固定） | 原稿区域索引与此数据组绑定 |
| 风险 收入验证 | `theme17_page060` · `stages` | 2–3 | 非负 |
| 风险 监管合规 | `theme17_page061` · `rows` | 3–5 | 非负 |
| 风险 算力成本 | `theme17_page062` · `gauge` | 3（固定） | 原稿固定时间范围或固定业务构成 |
| 风险 壁垒压缩 | `theme17_page063` · `indicators` | 2–3 | 非负 |
| 前瞻 Forward | `theme17_page069` · `metrics` | 3–5 | 非负 |
| 口径 数据来源 | `theme17_page070` · `rows` | 4–6 | 非负 |
| 数据条形比较 | `theme17_chart_bar` · `items` | 2–12 | 允许合法负值 |
| 数据柱形趋势 | `theme17_chart_column` · `items` | 2–12 | 允许合法负值 |
| 数据占比结构 | `theme17_chart_donut` · `items` | 2–6 | 非负，合计 100% |
| 数据贡献瀑布 | `theme17_chart_waterfall` · `items` | 2–12 | 允许合法负值 |
| HW-图表Bento-竖柱 | `theme17_chart_hw_column_bento` · `chart.items` | 2–12 | 非负；自动范围或固定 0–100 |
| HW-图表Bento-横条 | `theme17_chart_hw_bar_bento` · `chart.items` | 2–5 | 非负；自动范围或固定 0–100 |
| HW-图表Bento-饼图 | `theme17_chart_hw_donut_bento` · `chart.items` | 2–6 | 非负，合计 100% |
| HW-图表-折线 | `theme17_chart_hw_line` · `chart.items` | 2–12 | 非负；自动范围或固定 0–100 |
| HW-图表-面积 | `theme17_chart_hw_area` · `chart.items` | 2–12 | 非负；自动范围或固定 0–100 |
| HW-图表-雷达 | `theme17_chart_hw_radar` · `chart.items` | 4（固定） | 原稿固定为四维雷达 |

规则唯一来源：`project/assets/chart-item-contracts.mjs`。生成校验、脑图容量检查、inspect 元数据、HW 图表和控制台复用同一规则。新增图表或原稿变体时同时注册边界并做最小/最大数量的真实浏览器测量，不能仅依据数组原型长度推断安全容量。

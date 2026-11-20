# 安装自检与跨电脑使用

## 固定定位方法

Skill 根目录是当前宿主实际加载的 `SKILL.md` 所在目录，不是当前工作目录，也不是其下的 `project/`。新任务先核对安装，再分析附件和编写长篇内容草稿，避免最后才发现组件缺失。

| 文件 | 用途 |
| --- | --- |
| `scripts/content-workbench.mjs` | 推荐的统一入口；`doctor` 不依赖 npm 包 |
| `scripts/content_workbench.mjs` | 旧下划线命令兼容入口，转发到统一入口 |
| `project/scripts/content-workbench.mjs` | 内部实现，不用于猜测 Skill 根目录 |
| `project/examples/content-demo.json` | 安装包自带的内容草稿示例 |
| `installation-manifest.json` | 版本和随包文件校验值；不是数字签名或来源认证 |

`content-draft.json` / `draft.json` 是本次任务应由 Agent 创建的输出，不是安装包中必带的文件。不要因找不到该文件而判定精细模式缺组件。

## 开始前的自检

```bash
node "<skill-root>/scripts/content-workbench.mjs" doctor
```

Windows 中 `node` 未在当前 bash 的 PATH 上时，先用 PowerShell 的 `Get-Command node` 或宿主公开的运行路径确认已有 Node，不进行全盘搜索，不改全局环境变量。已找到 Node 后始终使用其绝对路径；PowerShell 调用带空格路径必须使用调用符：

```powershell
& '<已确认的Node绝对路径>' '<skill-root>/scripts/content-workbench.mjs' doctor
```

自检返回实际 Skill 根目录、版本、Node 可执行路径和版本、检查文件数、缺失/校验不符文件，以及依赖准备情况。没有网络请求、不自动安装、不调用模型、不读取业务附件或凭据、不创建项目。文件校验失败时退出码为 2；不要忽略。

- `ok:true` / `readyForFineReview:true`：安装与 Node 检查通过，可进入脑图内容审查。
- `readyForGeneration:false`：生成依赖未齐全，不代表脑图脚本没安装。按结果在 `project/` 准备依赖；内网使用已批准的镜像或离线包，不静默联网。
- `browserExportCheck:not-run`：没有在自检中启动浏览器或验证 PPTX/PDF，不据此声称全部导出能力已通过。
- `SKILL_FILE_MISSING`：列出的文件确实缺失，重新完整解压同一版本 ZIP；不要只复制 `SKILL.md`。
- `SKILL_FILE_MISMATCH` / `SKILL_VERSION_MIXED`：可能混装版本、解压异常或文件被修改。保留项目输出后，用完整同版本安装目录替换，勿混合覆盖不同版本。
- `DEPENDENCY_LOCK_UPDATED`：正常安装依赖可能修改 `project/package-lock.json`，仅提示，不误报脚本损坏；缺失锁文件或其他组件的校验失败仍报错。
- 根目录本身不对：对已确认的安装根目录使用 `doctor --root "<skill-root>"`。不根据当前 cwd 或随意找到的同名目录推断宿主加载位置。

如果连统一入口也不存在，不能运行自检：先列出当前加载的 `SKILL.md` 绝对路径及其同级目录，报告安装不完整并请求完整安装包。不能声称精细模式与直出等效，不能为了继续而生成替代脚本或换用其他 Skill。

## 精细模式的失败边界

用户选择精细模式后，安装错误、Node 路径问题或依赖缺失都不构成切换直出的授权。保持原模式、保留材料，报告真实检查路径、版本、错误代码与下一步；用户明确同意切换后才能更新需求记录。带 `brief.workflowMode:"fine"` 的草稿不能被 `direct --mode direct` 覆盖；标记精细模式的传统 goal 也不能用 `--fast` 跳过脑图。

推荐命令始终通过统一入口：

```bash
node "<skill-root>/scripts/content-workbench.mjs" route --mode fine
node "<skill-root>/scripts/content-workbench.mjs" create --mode fine --project "<工作目录>/output/<项目>" --plan "<工作目录>/content-draft.json" --host <实际宿主>
node "<skill-root>/scripts/content-workbench.mjs" start --project "<工作目录>/output/<项目>"
```

公开入口自动执行安装完整性检查；内部实现不代替安装诊断。不要将“当前 shell 找不到 node”“生成依赖缺失”和“Skill 文件没有安装”混为一种错误。

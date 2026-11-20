# Same-host Agent bridge

## Bind the generator, not an arbitrary installed CLI

The Agent running this skill adds its own host to both `create` and `start`: `--host deepseek|opencode|claude|codex`. It must use its actual identity, not the model name. Environment signals and a `.dsh/skills` installation can also identify the host. The private project binding survives browser refreshes, server restarts and launches from another terminal. An explicit new `--host` rebinds it; ordinary restart preserves it.

Automatic mode uses only this bound host. Merely finding another CLI on PATH is not authorization to switch. If an old project is unbound, return BRIDGE_HOST_UNKNOWN and ask the originating Agent to start it with the right host. Never label a file-existence probe as a successful model call. The UI distinguishes the recorded host, located entry and actual task progress.

## Built-in adapters

Standalone HTML previews have no content-workbench owner. The renderer records the actual generating host in the preview's private layout-agent context. Legacy independent previews can explicitly connect through **Agent 连接设置** without regenerating the deck or inventing a content-plan.json. A real content project always takes precedence. Moving/copying a standalone preview invalidates its location-bound connection until explicitly reconnected. The public status and config endpoints never expose credentials. Saving a connection only probes the executable; it does not invoke the model or claim login/network success. Unbound or unavailable bridges are rejected before a layout task is queued. Existing active/pending tasks must be resolved before changing the binding.

For Codex, the existing CLI authentication and configuration remain owned by Codex. This skill does not copy auth files or change user-level model settings. A blank per-preview model follows the CLI configuration, which need not be identical to a desktop chat's model selection. See [official non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

| Host | Invocation / result contract |
| --- | --- |
| DeepSeek Harness | `dsh --profile headless --patch <invocation overlay> --json -`; UTF-8 prompt on stdin; final text parsed as operations |
| OpenCode | `opencode run --format json`; text events contain final operations |
| Claude Code | noninteractive stream-json, no tools; result event |
| Codex CLI | `codex exec --json --sandbox read-only --skip-git-repo-check --ephemeral -`; agent_message event |
| Other harness | explicit JSON Worker descriptor and the protocol below |

DeepSeek Desktop's official bundled `resources/runtime/cli/bin/dsh.cmd` can be used without registering a system command. On Windows the adapter invokes its installed Electron/CLI entry directly in Node mode, not by constructing a shell command. Native npm CLI wrappers are also resolved to their executable or JavaScript entry. No PATH changes, administrator-mode request or security-policy bypass is performed.

When the host supplies its real installation/CLI path in runtime context, bind that absolute entry using a host descriptor instead of guessing from the first PATH hit. The Windows search preserves adapter kind `deepseek` while searching command name `dsh`; unusable `.cmd` shims are skipped so a later valid same-host entry can be found. Explicit broken bindings remain errors and never switch to another Agent. Do not bake a particular employee's executable path into the Skill or modify user-level environment variables automatically.

DeepSeek's private host binding records only home path and public provider/model/effort selectors. The adapter reads just the `agent-default-model` row in the Desktop profile patch when inheriting selection. Credentials remain owned and read by Harness; invocation-only overlay enables its normal credential services because the stock headless profile disables GUI stored authentication. No key/token is copied into this skill, browser state or generated PPT. A fresh bounded headless session is used, not the user's live conversation. Custom Desktop-only provider plugins may require a dedicated callable profile/adapter; never assume its availability.

The content prompt contains the relevant draft and brief. It forbids tools and file writes; adapters keep their restrictive execution mode. All returned operations still pass scope, number, stale-version and explicit-proposal guards. Pause/cancel terminates the owned process tree; late results cannot overwrite content. Structured UTF-8 streams must not corrupt Chinese text at chunk boundaries.

## DeepSeek progress and invocation effort

DeepSeek headless JSON `text`/`thinking` events describe committed steps, not live deltas. A silent `step_start` is not evidence of zero model activity. The invocation overlay loads the bundled `deepseek-observer.mjs`, which emits only live phase and character counts, retry/error codes and the owned session ID; it never emits reasoning text, prompt, credentials or response body. The normal final event remains the only authoritative answer. The observer relies on the installed Harness event interface and was tested against 0.2.1-rc.3; old versions without those events may provide only ordinary committed progress.

The preview may explicitly select `inherit`, `low` or `high` for one DeepSeek adaptation call. Default is `inherit`; no global Harness configuration is changed and provider/model remain bound to the original host. High effort may spend minutes reasoning before returning a small JSON candidate. Do not silently reduce effort, increase the user's hard deadline, or retry indefinitely. A timeout now distinguishes observed live generation from no observed live content. Recent-output time is not refreshed by the bridge's own timeout/exit bookkeeping.

## Other agents and employee-assistant wrappers

A skill cannot infer an undocumented private invocation API from an application name. To support another harness without silently switching, the originating Agent supplies `--host-file adapter.json` once:

```json
{"kind":"json-worker","label":"Company Harness","command":"C:/runtime/node.exe","args":["C:/adapters/company-worker.mjs"]}
```

The descriptor contains no credentials and uses absolute entry paths. `command` is executed with an argument array and `shell:false`. Its wrapper must call that same originating harness through an authorized public interface, preserve its model configuration, and emit this stdout JSON result:

```json
{"summary":"Change summary","operations":[{"op":"replaceText","slideId":"slide-id","target":{"field":"title"},"before":"Original","after":"Candidate"}]}
```

stdin is one JSON line: `{protocol:"dashi.content-edit.v1",taskId,scope,messages}`. Optional stdout progress lines use `{type:"progress",percent,detail}`; the final line has `operations`. Diagnostics stay on stderr and must not reveal credentials. Exit nonzero on errors. Do not fabricate adapters or read unrelated applications' secret stores to force compatibility.

Primary protocol references: [DeepSeek headless](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/headless), [DeepSeek Desktop CLI](https://github.com/deepseek-ai/deepseek-harness/tree/master/apps/desktop#bundled-command-runtime), [Codex noninteractive workflows](https://developers.openai.com/blog/codex-as-a-platform).

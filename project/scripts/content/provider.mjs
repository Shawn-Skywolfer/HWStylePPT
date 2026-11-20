import fs from 'node:fs';
import path from 'node:path';
import { atomicJson } from './store.mjs';
import { WorkbenchError } from './model.mjs';

export function providerConfig(dir) {
  let saved = {};
  const file = path.join(dir, '.private', 'model.json');
  if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { baseUrl: process.env.DASHI_AI_BASE_URL || saved.baseUrl || '', model: process.env.DASHI_AI_MODEL || saved.model || '',
    apiKey: process.env.DASHI_AI_API_KEY || saved.apiKey || '', temperature: saved.temperature ?? 0.3, maxTokens: saved.maxTokens ?? 4096,
    timeoutMs: saved.timeoutMs ?? 120000 };
}
export function publicProviderConfig(dir) { const { apiKey, ...safe } = providerConfig(dir); return { ...safe, hasApiKey: !!apiKey, keyFromEnvironment: !!process.env.DASHI_AI_API_KEY }; }
export function saveProviderConfig(dir, input) {
  const old = providerConfig(dir);
  const next = { ...old, baseUrl: String(input.baseUrl || '').trim().replace(/\/$/, ''), model: String(input.model || '').trim(),
    temperature: Number(input.temperature ?? old.temperature), maxTokens: Number(input.maxTokens ?? old.maxTokens), timeoutMs: Number(input.timeoutMs ?? old.timeoutMs) };
  if (input.apiKey) next.apiKey = String(input.apiKey);
  if (input.clearApiKey) next.apiKey = '';
  if (next.baseUrl) endpoint(next.baseUrl);
  if (!Number.isFinite(next.temperature) || next.temperature < 0 || next.temperature > 2 || !Number.isInteger(next.maxTokens) || next.maxTokens < 128 || next.maxTokens > 65536 || !Number.isFinite(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 600000) throw new WorkbenchError('模型参数范围无效。');
  // This private file is never exposed by the HTTP router or copied into a deck.
  // Environment keys remain environment-only; only keys explicitly entered are persisted.
  if (process.env.DASHI_AI_API_KEY && !input.apiKey) delete next.apiKey;
  atomicJson(path.join(dir, '.private', 'model.json'), next);
  return publicProviderConfig(dir);
}
function endpoint(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { throw new WorkbenchError('Base URL 无效。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new WorkbenchError('Base URL 只支持无账号信息的 HTTP/HTTPS 地址。');
  return `${url.href.replace(/\/$/, '')}${url.pathname.endsWith('/chat/completions') ? '' : '/chat/completions'}`;
}
export async function callModel(dir, messages, { test = false, signal, onProgress=()=>{},timeoutMs,onDiagnostic=()=>{} } = {}) {
  const config = providerConfig(dir);
  if(timeoutMs!=null){if(!Number.isFinite(Number(timeoutMs))||Number(timeoutMs)<1000||Number(timeoutMs)>600000)throw new WorkbenchError('模型等待上限需为 1–600 秒。');config.timeoutMs=Number(timeoutMs);}
  if (!config.baseUrl || !config.model) throw new WorkbenchError('请先配置模型的 Base URL 和 Model，或选择 Agent 桥接模式。', 422, 'MODEL_NOT_CONFIGURED');
  const apiUrl = endpoint(config.baseUrl);
  let response;
  const startedAt=Date.now(),trace=(type,message,extra={})=>onDiagnostic({type,message,at:new Date().toISOString(),elapsedMs:Date.now()-startedAt,timeoutMs:config.timeoutMs,executor:'provider',...extra});
  try {
    trace('connecting','正在请求原项目配置的模型服务');
    onProgress({stage:'connecting',detail:'正在连接模型服务',percent:15});
    response = await fetch(apiUrl, { method: 'POST', signal: signal?AbortSignal.any([signal,AbortSignal.timeout(config.timeoutMs)]):AbortSignal.timeout(config.timeoutMs),
      headers: { 'content-type': 'application/json', ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, temperature: config.temperature, max_tokens: test ? 32 : config.maxTokens, stream: false, messages }) });
  } catch (error) {
    if(signal?.aborted) throw signal.reason || error;
    const e=new WorkbenchError(error.name === 'TimeoutError' ? '模型调用超时，请检查服务或提高超时设置。' : '无法连接模型服务，请检查内网地址、网络与证书。', 502, error.name==='TimeoutError'?'MODEL_TIMEOUT':'MODEL_CONNECTION_FAILED');e.details={timeoutMs:config.timeoutMs,elapsedMs:Date.now()-startedAt,phase:'waiting-response'};throw e;
  }
  if (!response.ok) {
    trace('http-error','模型服务返回错误状态',{status:response.status});
    // Provider error bodies can echo keys or prompts; do not relay raw bodies.
    throw new WorkbenchError(`模型服务返回 HTTP ${response.status}。${response.status === 401 || response.status === 403 ? '请检查 API Key 和访问权限。' : response.status === 429 ? '请检查配额或限流。' : '请检查模型名称、兼容接口和服务日志。'}`, 502, 'MODEL_HTTP_ERROR');
  }
  let result;
  trace('headers','已收到模型服务响应头',{status:response.status});
  onProgress({stage:'receiving',detail:'已收到模型响应，正在校验内容',percent:80});
  try { result = await response.json(); } catch { throw new WorkbenchError('模型服务返回了非 JSON 响应。', 502); }
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new WorkbenchError('模型没有返回文字内容，请检查 OpenAI-compatible 响应格式。', 502);
  if (test) return { ok: true, message: '连接成功，模型已返回响应。' };
  try { return JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')); }
  catch { throw new WorkbenchError('模型未返回有效的 JSON 修改提案，正式稿未改变。请重试或调整模型。', 422, 'MODEL_INVALID_JSON'); }
}

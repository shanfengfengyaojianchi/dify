export class UserError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') { super(message); this.status = status; this.code = code; }
}
export const keyName = id => `DIFY_KEY_${id.replaceAll('-', '_').toUpperCase()}`;
export function configuration(toolId, env) {
  const dedicated = (env[keyName(toolId)] || '').trim();
  const shared = (env.DIFY_API_KEY || '').trim();
  return { key: dedicated || shared, shared: !dedicated && !!shared, base: (env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '') };
}
export function validateInputs(tool, inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new UserError('请填写工作资料。');
  const clean = {};
  const known = new Set(tool.fields.map(f => f.key));
  if (Object.keys(inputs).some(k => !known.has(k))) throw new UserError('提交中包含该工具不支持的字段。');
  for (const field of tool.fields) {
    const raw = inputs[field.key];
    if (raw !== undefined && typeof raw !== 'string') throw new UserError(`${field.label}必须是文本。`);
    const value = (raw || '').trim();
    if (field.required && !value) throw new UserError(`请填写${field.label}。`);
    const limit = field.type === 'textarea' ? 10000 : 500;
    if (value.length > limit) throw new UserError(`${field.label}最多 ${limit} 个字符。`);
    if (field.type === 'select' && !field.options.includes(value)) throw new UserError(`请选择有效的${field.label}。`);
    clean[field.key] = value;
  }
  if (Object.values(clean).join('').length > 30000) throw new UserError('资料合计最多 30000 个字符，请分批处理。');
  return clean;
}
export function parseTable(text) {
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) return null;
    if (parsed.columns.length === 0 || parsed.columns.length > 30 || parsed.rows.length > 500) return null;
    if (!parsed.columns.every(c => typeof c === 'string' && c.length <= 200)) return null;
    if (!parsed.rows.every(row => Array.isArray(row) && row.length === parsed.columns.length && row.every(c => typeof c === 'string' && c.length <= 10000))) return null;
    return {columns:parsed.columns, rows:parsed.rows};
  } catch { return null; }
}
export function csvFor(table) {
  const cell = value => {
    const text = String(value);
    // Prevent spreadsheet programs treating user or model text as executable formulas.
    const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [table.columns, ...table.rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export async function runWorkflow(tool, inputs, env, user, fetcher = fetch) {
  const clean = validateInputs(tool, inputs);
  const config = configuration(tool.id, env);
  if (!config.key) throw new UserError('这个工具尚未配置 Dify。可以先查看示例，或按连接说明配置工作流。', 503, 'NOT_CONFIGURED');
  let base;
  try { base = new URL(config.base); } catch { throw new UserError('Dify 地址配置无效，请检查服务器环境变量。', 503, 'BAD_CONFIGURATION'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new UserError('Dify 地址配置无效。', 503, 'BAD_CONFIGURATION');
  const payload = config.shared ? {tool_id:tool.id, input_data:JSON.stringify(clean)} : clean;
  let response;
  try {
    response = await fetcher(`${config.base}/workflows/run`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${config.key}`},
      body:JSON.stringify({inputs:payload, response_mode:'blocking', user}), redirect:'error', signal:AbortSignal.timeout(90000)
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new UserError('生成超时，请稍后重试或缩短资料。', 504, 'TIMEOUT');
    throw new UserError('暂时无法连接 Dify，请检查服务地址和网络。', 502, 'UPSTREAM_UNAVAILABLE');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new UserError('Dify 密钥无效或没有访问权限，请检查后台配置。', 502, 'UPSTREAM_AUTH');
    if (response.status === 429) throw new UserError('Dify 请求过于频繁，请稍后重试。', 429, 'RATE_LIMITED');
    throw new UserError('Dify 未能完成请求，请检查工作流是否已发布及运行日志。', 502, 'UPSTREAM_ERROR');
  }
  let data;
  try { data = await response.json(); } catch { throw new UserError('Dify 返回了无法识别的结果。', 502, 'BAD_RESPONSE'); }
  if (data.data?.status !== 'succeeded') throw new UserError('工作流没有成功完成，请在 Dify 检查运行记录。', 502, 'WORKFLOW_FAILED');
  const outputs = data.data.outputs || {};
  const text = outputs.result ?? outputs.text ?? outputs.answer;
  if (typeof text !== 'string' || !text.trim() || text.length > 200000) throw new UserError('工作流没有返回有效文本，请检查结束节点的 result 输出。', 502, 'BAD_OUTPUT');
  const table = tool.id === 'data-extractor' ? parseTable(text) : null;
  if (tool.id === 'data-extractor' && !table) throw new UserError('提取结果格式不符合表格要求，请检查工作流输出或重试。', 502, 'BAD_TABLE');
  return {text, table, mode:'live', toolId:tool.id, generatedAt:new Date().toISOString(), runId:data.workflow_run_id || data.data.id || null};
}

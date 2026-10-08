'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Store,Factory,NotebookPen,Clapperboard,Package,MessagesSquare,Handshake,ClipboardList,ChartNoAxesCombined,Table2,Layers,FlaskConical,Sparkles,FileText,Copy,Download,Plug,Loader2,AlertCircle,Check,BookOpen} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {tools,getTool, type Tool} from '@/lib/catalog';
import examples from '@/lib/examples.json';
import {parseTable,csvFor} from '@/lib/core.mjs';
import {ResultView,type ResultTable} from '@/components/result-view';
const icons:Record<string, typeof Store>={store:Store,factory:Factory,notebook:NotebookPen,clapperboard:Clapperboard,package:Package,messages:MessagesSquare,handshake:Handshake,clipboard:ClipboardList,chart:ChartNoAxesCombined,table:Table2};
type Result={text:string;table?:ResultTable|null;mode:'example'|'live';toolId:string;generatedAt?:string;runId?:string|null;inputSnapshot:Record<string,string>};
type Status={configuredCount:number;tools:Record<string,{configured:boolean}>};
type WebTool={name:string;description:string;title:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};
type ModelContext={registerTool:(tool:WebTool,options:{signal:AbortSignal})=>unknown};
const defaults=(tool:Tool)=>Object.fromEntries(tool.fields.filter(f=>f.type==='select').map(f=>[f.key,f.options![0]]));
const filename=(id:string)=>`${String(tools.findIndex(t=>t.id===id)+1).padStart(2,'0')}-${id}.yml`;
function saveFile(text:string,name:string,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Home(){
 const [toolId,setToolId]=useState(tools[0].id);
 const [values,setValues]=useState<Record<string,string>>(defaults(tools[0]));
 const [result,setResult]=useState<Result|null>(null);
 const [status,setStatus]=useState<Status|null>(null);
 const [statusError,setStatusError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const [setupOpen,setSetupOpen]=useState(false);
 const [outputTab,setOutputTab]=useState('preview');
 const busyRef=useRef(false);
 const tool=getTool(toolId)!; const Icon=icons[tool.icon];
 const ready=!!status?.tools[toolId]?.configured;
 const stale=!!result&&JSON.stringify(result.inputSnapshot)!==JSON.stringify(values);
 const refreshStatus=useCallback(async()=>{try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw new Error();const v=await r.json() as Status;setStatus(v);setStatusError(false);}catch{setStatusError(true);}},[]);
 useEffect(()=>{void refreshStatus();},[refreshStatus]);
 function chooseTool(id:string){if(busyRef.current)throw new Error('请等待当前生成完成。');const next=getTool(id);if(!next)throw new Error('找不到这个工具。');setToolId(id);setValues(defaults(next));setResult(null);setError('');setFieldErrors({});setOutputTab('preview');}
 function viewExample(id=toolId){if(busyRef.current)throw new Error('请等待当前生成完成。');const next=getTool(id);if(!next)throw new Error('找不到这个工具。');const text=examples[id as keyof typeof examples];setToolId(id);setValues({...next.example});setResult({text,table:id==='data-extractor'?parseTable(text):null,mode:'example',toolId:id,inputSnapshot:{...next.example}});setError('');setFieldErrors({});setOutputTab('preview');return {toolId:id,mode:'example',text};}
 async function generate(id=toolId,input=values){
  if(busyRef.current)throw new Error('已有生成正在进行。');
  const selected=getTool(id);if(!selected)throw new Error('找不到这个工具。');
  const invalid:Record<string,string>={};for(const f of selected.fields){if(!input[f.key]?.trim())invalid[f.key]=`请填写${f.label}`;else if(input[f.key].length>(f.type==='textarea'?10000:500))invalid[f.key]='资料过长，请缩短后重试';else if(f.type==='select'&&!f.options!.includes(input[f.key]))invalid[f.key]='请选择有效选项';}
  if(Object.keys(invalid).length){setFieldErrors(invalid);throw new Error('请补全必填资料。');}
  setToolId(id);setValues({...input});setResult(previous=>previous?.toolId===id?previous:null);setFieldErrors({});setError('');setBusy(true);busyRef.current=true;
  try{const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toolId:id,inputs:input})});const data=await response.json() as Omit<Result,'inputSnapshot'> & {error?:string};if(!response.ok)throw new Error(data.error||'生成失败，请稍后重试。');const next={...data,inputSnapshot:{...input}};setResult(next);setOutputTab('preview');toast.success('结果已生成');return {toolId:id,mode:'live',text:next.text,runId:next.runId};}
  catch(e){const message=e instanceof Error?e.message:'暂时无法生成，请稍后重试。';setError(message);throw new Error(message);}
  finally{setBusy(false);busyRef.current=false;}
 }
 // Refs keep browser tools on the same actions and state used by visible controls.
 const actions=useRef({chooseTool,viewExample,generate});actions.current={chooseTool,viewExample,generate};
 useEffect(()=>{
  const context=(document as unknown as {modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const checked=(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('需要对象参数');const id=(input as {toolId?:unknown}).toolId;if(typeof id!=='string'||!getTool(id))throw new Error('无效工具编号');return id;};
  const settled=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const registered:WebTool[]=[
   {name:'read_workroom_tools',title:'查看业务工具',description:'读取工作间的 10 个工具及其输入字段。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>tools.map(t=>({id:t.id,name:t.name,fields:t.fields}))},
   {name:'select_workroom_tool',title:'选择业务工具',description:'选择工具并清空当前表单和结果，不调用模型。',inputSchema:{type:'object',properties:{toolId:{type:'string',enum:tools.map(t=>t.id)}},required:['toolId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{const id=checked(input);actions.current.chooseTool(id);await settled();return {selectedToolId:id};}},
   {name:'view_workroom_example',title:'查看固定示例',description:'填入所选工具的预设案例并显示固定示例结果，不进行真实生成。',inputSchema:{type:'object',properties:{toolId:{type:'string',enum:tools.map(t=>t.id)}},required:['toolId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{const result=actions.current.viewExample(checked(input));await settled();return result;}},
   {name:'generate_workroom_result',title:'通过 Dify 生成结果',description:'把工具资料发送到已配置的 Dify 工作流真实生成，可能产生模型费用；缺少配置会失败，不回退为示例。',inputSchema:{type:'object',properties:{toolId:{type:'string',enum:tools.map(t=>t.id)},inputs:{type:'object',additionalProperties:{type:'string'}}},required:['toolId','inputs'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{const id=checked(input);const fields=(input as {inputs?:unknown}).inputs;if(!fields||typeof fields!=='object'||Array.isArray(fields)||!Object.values(fields).every(v=>typeof v==='string'))throw new Error('输入字段必须是文本');const result=await actions.current.generate(id,fields as Record<string,string>);await settled();return result;}}
  ];
  for(const item of registered)try{void Promise.resolve(context.registerTool(item,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return ()=>lifecycle.abort();
 },[]);
 async function copy(){if(!result)return;try{await navigator.clipboard.writeText(result.text);toast.success('已复制结果');}catch{toast.error('复制不可用，请切换到原文后手动复制。');}}
 function download(){if(!result)return;const label=result.mode==='example'?'示例':'生成结果';saveFile(`# ${tool.name} · ${label}\n\n${result.text}`,`${tool.name}-${label}.md`,'text/markdown;charset=utf-8');}
 return <div className="market-shell">
  <Toaster position="bottom-right" theme="light"/>
  <header className="topbar"><a href="/" className="brand"><span className="brand-mark"><Layers size={22}/></span><strong>工作间<span>AI 工具超市</span></strong></a><span className="topbar-note">从资料到交付，少一点重复工作</span><div className="header-actions"><span className={`connection-pill ${status?.configuredCount?'configured':''}`} aria-live="polite">{status?.configuredCount?<Plug size={15}/>:<FlaskConical size={15}/>} {status?.configuredCount?`${status.configuredCount}/10 已配置`:statusError?'状态暂不可用':status?'示例模式':'检查配置中'}</span><button className="setup-button" onClick={()=>setSetupOpen(true)}><Plug size={16}/><span>连接与模板</span></button></div></header>
  <main className="main-wrap"><section className="workspace-heading"><div><p className="eyebrow">YOUR EVERYDAY TOOLKIT</p><h1>选一个工具，开始工作。</h1></div><span className="tool-count"><strong>10</strong> 款业务工具</span></section>
   <div className="workspace"><section className="tool-panel" aria-label="工具列表"><div className="panel-caption"><span>我的工具箱</span><span>10</span></div><div className="tool-list">{tools.map(t=>{const I=icons[t.icon];return <button disabled={busy} aria-pressed={t.id===toolId} className={`tool-item ${t.id===toolId?'active':''}`} key={t.id} onClick={()=>chooseTool(t.id)}><span className={`tool-icon ${t.color}`}><I size={20}/></span><span><strong>{t.name}</strong><small>{t.category}</small></span></button>;})}</div><div className="catalog-foot"><FlaskConical size={17}/><span>先看示例，连接后真实生成</span></div><a className="template-link" href="/dify/workroom-dify-templates.zip" download><Download size={14}/>下载全部工作流</a></section>
    <section className="input-panel"><div className="input-heading"><span className={`tool-icon large ${tool.color}`}><Icon size={24}/></span><p className="eyebrow">{tool.category}</p><h2>{tool.name}</h2><p>{tool.description}</p></div><div className="form-topline"><span>填写工作资料</span><button disabled={busy} className="text-button" onClick={()=>{setValues({...tool.example});setFieldErrors({});}}>填入示例</button></div><form className="tool-form" noValidate onSubmit={e=>{e.preventDefault();void generate().catch(()=>{});}}>{tool.fields.map(f=><div className="field" key={f.key}><label htmlFor={f.key}>{f.label}<span>{f.required?' *':''}</span></label>{f.type==='select'?<Select disabled={busy} value={values[f.key]||f.options![0]} onValueChange={v=>setValues(p=>({...p,[f.key]:v}))}><SelectTrigger id={f.key} className="field-select" aria-required aria-invalid={!!fieldErrors[f.key]}><SelectValue/></SelectTrigger><SelectContent>{f.options!.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>:f.type==='textarea'?<textarea id={f.key} disabled={busy} required maxLength={10000} aria-invalid={!!fieldErrors[f.key]} aria-describedby={fieldErrors[f.key]?`${f.key}-error`:undefined} value={values[f.key]||''} placeholder={f.placeholder} onChange={e=>setValues(p=>({...p,[f.key]:e.target.value}))}/>:<input id={f.key} disabled={busy} required maxLength={500} aria-invalid={!!fieldErrors[f.key]} aria-describedby={fieldErrors[f.key]?`${f.key}-error`:undefined} value={values[f.key]||''} placeholder={f.placeholder} onChange={e=>setValues(p=>({...p,[f.key]:e.target.value}))}/>} {fieldErrors[f.key]&&<span className="field-error" id={`${f.key}-error`}>{fieldErrors[f.key]}</span>}</div>)}
    {ready?<><button disabled={busy} type="submit" className="primary-button">{busy?<Loader2 size={17} className="spin"/>:<Sparkles size={17}/>} {busy?'正在生成与校对…':'生成结果'}</button><button disabled={busy} type="button" className="secondary-button" onClick={()=>viewExample()}><FlaskConical size={16}/>查看预设示例</button></>:<><button disabled={busy} type="button" className="primary-button" onClick={()=>viewExample()}><FlaskConical size={17}/>查看示例结果</button><div className="unconfigured-note"><span>此工具尚未配置，示例使用固定案例。</span><button type="button" className="text-button" onClick={()=>setSetupOpen(true)}>连接 Dify</button></div></>}
    </form><p className="form-note">请填写真实资料。缺失的信息会保留为“待确认”。</p><a href={`/dify/${filename(tool.id)}`} download className="single-template"><Download size={13}/>下载此工具工作流</a></section>
    <section className="output-panel" aria-busy={busy}><div className="output-toolbar"><div><FileText size={18}/><h2>工作结果</h2></div>{result?<div className="result-actions"><button disabled={busy} aria-label="复制结果" title="复制结果" onClick={()=>void copy()}><Copy size={16}/></button><button disabled={busy} aria-label="下载结果" title="下载 Markdown 结果" onClick={download}><Download size={16}/></button>{result.table&&<button disabled={busy} className="csv-button" onClick={()=>saveFile(csvFor(result.table),`${tool.name}-${result.mode==='example'?'示例':'生成结果'}.csv`,'text/csv;charset=utf-8')}>CSV</button>}</div>:<span>{tool.output}</span>}</div>
    {error&&<div className="error-banner" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
    {busy?<div className="output-empty" role="status"><Loader2 size={32} className="spin"/><h3>正在生成，再核对一遍事实</h3><p>资料已发送至 Dify，请稍候。</p></div>:result?<div className="result-wrap"><div className={`result-origin ${result.mode}`}><span>{result.mode==='example'?<FlaskConical size={15}/>:<Check size={15}/>} {result.mode==='example'?'预设示例 · 非实时生成':'Dify 真实生成'}</span>{result.mode==='live'&&result.generatedAt&&<time>{new Date(result.generatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'})}</time>}</div>{result.mode==='example'&&<p className="sample-note">以下结果对应已填入的示例资料。新资料需要连接 Dify 后生成。</p>}{stale&&<p className="stale-note">表单已修改，以下仍是上次结果。</p>}<Tabs value={outputTab} onValueChange={setOutputTab}><TabsList className="result-tabs" variant="line"><TabsTrigger value="preview">预览</TabsTrigger><TabsTrigger value="source">原文</TabsTrigger></TabsList><TabsContent value="preview" className="result-content"><ResultView text={result.text} table={result.table}/></TabsContent><TabsContent value="source"><pre className="raw-result">{result.text}</pre></TabsContent></Tabs></div>:<div className="output-empty"><span className="empty-icon"><FileText size={32}/></span><h3>你的下一份交付，从这里开始</h3><p>填写左侧资料，或先查看工具示例。</p><button className="empty-example" onClick={()=>viewExample()}>试试「{tool.name}」示例</button><div className="output-chips">{tool.output.split(' · ').map(s=><span key={s}>{s}</span>)}</div></div>}
    <div className="output-footer">{result?.mode==='example'?'示例仅用于预览，交付前请核对业务资料。':'保留事实，明确待确认项。交付前请复核。'}</div></section>
   </div><footer className="page-footer"><span>工作间 / WORKROOM</span><span>内容创作 · 营销销售 · 办公效率</span></footer>
  </main>
 <Dialog open={setupOpen} onOpenChange={setSetupOpen}><DialogContent className="setup-dialog"><DialogHeader><DialogTitle>连接 Dify，让工具实际工作</DialogTitle><DialogDescription>先下载模板，导入并选择可用模型，再配置服务器密钥。</DialogDescription></DialogHeader><div className="setup-steps"><div><span>01</span><section><h3>下载并导入</h3><p>推荐导入统一入口，一次接通 10 个工具。也可以分别导入 10 份独立模板。</p><a className="download-bundle" href="/dify/workroom-dify-templates.zip" download><Download size={16}/>下载模板包</a></section></div><div><span>02</span><section><h3>选择模型、测试并发布</h3><p>在“生成草稿”和“事实与格式校对”节点选择你已配置的模型，测试通过后发布，创建该应用的 API Key。</p></section></div><div><span>03</span><section><h3>配置服务器</h3><p>将应用密钥填入服务器的 <code>DIFY_API_KEY</code>。本地填写 <code>.env.local</code>，云端填写部署环境变量，再重启或重新部署。密钥不要填进网页或聊天。</p></section></div></div><div className="setup-notice"><AlertCircle size={17}/><p>模板已完成结构检查，尚未在你的 Dify 中导入运行；导入后需选择模型并测试。</p></div><div className="setup-links"><a href="/dify/连接说明.md" download><BookOpen size={15}/>下载连接说明</a><button className="text-button" onClick={()=>void refreshStatus()}>重新检查配置</button></div></DialogContent></Dialog>
 </div>;
}

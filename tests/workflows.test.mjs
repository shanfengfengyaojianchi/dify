import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validateInputs,runWorkflow,parseTable,csvFor,keyName} from '../lib/core.mjs';
const yaml=createRequire(import.meta.url)('js-yaml');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const tools=JSON.parse(read('../lib/catalog.json'));
const examples=JSON.parse(read('../lib/examples.json'));
const tool=tools[0];
const response=text=>new Response(JSON.stringify({workflow_run_id:'test-run',data:{status:'succeeded',outputs:{result:text}}}),{status:200});
const errorCode=code=>e=>e.code===code;

test('all ten sample inputs satisfy validation; extraction example is a valid table',()=>{
 assert.equal(tools.length,10);assert.equal(new Set(tools.map(t=>t.id)).size,10);
 for(const t of tools){assert.deepEqual(validateInputs(t,t.example),t.example);assert.ok(examples[t.id].length>50);}
 assert.ok(parseTable(examples['data-extractor']));
});
test('invalid fields, missing data, long text and invalid select cannot reach a model',async()=>{
 const invalid=[{}, {...tool.example,extra:'unexpected'}, {...tool.example,store_name:12}, {...tool.example,store_name:'x'.repeat(501)}, {...tool.example,duration:'invalid'}];
 for(const input of invalid)await assert.rejects(runWorkflow(tool,input,{DIFY_API_KEY:'test-only'},'test',()=>assert.fail('must not fetch')),errorCode('INVALID_INPUT'));
});
test('missing configuration cannot silently become a successful example',async()=>{
 await assert.rejects(runWorkflow(tool,tool.example,{},'test',()=>assert.fail('must not fetch')),errorCode('NOT_CONFIGURED'));
});
test('dedicated application key takes precedence and sends the tool fields',async()=>{
 const result=await runWorkflow(tool,tool.example,{[keyName(tool.id)]:'dedicated-test',DIFY_API_KEY:'shared-test',DIFY_API_BASE_URL:'https://dify.example/v1/'},'test-user',async(url,init)=>{
  assert.equal(url,'https://dify.example/v1/workflows/run');assert.equal(init.headers.Authorization,'Bearer dedicated-test');
  assert.equal(init.redirect,'error');assert.deepEqual(JSON.parse(init.body),{inputs:tool.example,response_mode:'blocking',user:'test-user'});
  return response('结果');
 });
 assert.equal(result.mode,'live');assert.equal(result.runId,'test-run');
});
test('one shared application key routes each of the ten tools by tool_id',async()=>{
 for(const t of tools){await runWorkflow(t,t.example,{DIFY_API_KEY:'shared-test'},'test',async(_url,init)=>{
  const body=JSON.parse(init.body);assert.equal(body.inputs.tool_id,t.id);assert.deepEqual(JSON.parse(body.inputs.input_data),t.example);
  return response(examples[t.id]);
 });}
});
test('malformed server addresses fail before fetch',async()=>{
 for(const base of ['bad-url','file:///tmp','https://user:password@example.com/v1','https://example.com/v1?token=test']){
  await assert.rejects(runWorkflow(tool,tool.example,{DIFY_API_KEY:'test',DIFY_API_BASE_URL:base},'test',()=>assert.fail('must not fetch')),errorCode('BAD_CONFIGURATION'));
 }
});
test('upstream errors do not disclose an upstream response or key',async()=>{
 for(const [status,code]of [[401,'UPSTREAM_AUTH'],[403,'UPSTREAM_AUTH'],[429,'RATE_LIMITED'],[500,'UPSTREAM_ERROR']]){
  await assert.rejects(runWorkflow(tool,tool.example,{DIFY_API_KEY:'test-secret'},'test',async()=>new Response('debug: test-secret',{status})),e=>e.code===code&&!e.message.includes('test-secret'));
 }
});
test('network failure and timeout have actionable error codes',async()=>{
 for(const [name,code]of [['Error','UPSTREAM_UNAVAILABLE'],['TimeoutError','TIMEOUT']]){
  await assert.rejects(runWorkflow(tool,tool.example,{DIFY_API_KEY:'test'},'test',async()=>{const e=new Error('internal');e.name=name;throw e;}),errorCode(code));
 }
});
test('failed workflows, empty output and invalid response are rejected',async()=>{
 for(const [body,code]of [['not json','BAD_RESPONSE'],[JSON.stringify({data:{status:'failed'}}),'WORKFLOW_FAILED'],[JSON.stringify({data:{status:'succeeded',outputs:{result:''}}}),'BAD_OUTPUT']]){
  await assert.rejects(runWorkflow(tool,tool.example,{DIFY_API_KEY:'test'},'test',async()=>new Response(body)),errorCode(code));
 }
});
test('extraction requires rectangular string data rather than a plausible-looking answer',async()=>{
 const extractor=tools.find(t=>t.id==='data-extractor');
 for(const text of ['这是结果',JSON.stringify({columns:['a'],rows:[[12]]}),JSON.stringify({columns:['a','b'],rows:[['a']]})]){
  assert.equal(parseTable(text),null);
  await assert.rejects(runWorkflow(extractor,extractor.example,{DIFY_API_KEY:'test'},'test',async()=>response(text)),errorCode('BAD_TABLE'));
 }
 assert.deepEqual(parseTable('```json\n{"columns":["a"],"rows":[["b"]]}\n```'),{columns:['a'],rows:[['b']]});
});
test('CSV quotes embedded separators and neutralizes formula cells',()=>{
 const csv=csvFor({columns:['列'],rows:[['a,"b"\nc'],['=SUM(1,2)'],[' +CMD'],['@x'],['普通文本']]});
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"a,""b""\nc"'));assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"\' +CMD"'));assert.ok(csv.includes('"\'@x"'));assert.ok(csv.endsWith('"普通文本"'));
});
test('downloadable Dify templates have connected graphs and matching API inputs',()=>{
 const manifest=JSON.parse(read('../dify/manifest.json'));assert.equal(manifest.length,10);
 for(const entry of [...manifest,{filename:'00-shared-toolkit.yml',id:'shared'}]){
  const source=read(`../dify/${entry.filename}`);assert.equal(source,read(`../public/dify/${entry.filename}`));
  const dsl=yaml.load(source);assert.equal(dsl.app.mode,'workflow');assert.equal(dsl.kind,'app');
  const {nodes,edges}=dsl.workflow.graph;const ids=new Set(nodes.map(n=>n.id));assert.equal(nodes.length,4);assert.equal(edges.length,3);
  for(const edge of edges){assert.ok(ids.has(edge.source));assert.ok(ids.has(edge.target));}
  const start=nodes.find(n=>n.data.type==='start');const end=nodes.find(n=>n.data.type==='end');
  const keys=start.data.variables.map(v=>v.variable);
  assert.deepEqual(keys,entry.id==='shared'?['tool_id','input_data']:tools.find(t=>t.id===entry.id).fields.map(f=>f.key));
  assert.deepEqual(end.data.outputs[0].value_selector,['review','text']);assert.equal(end.data.outputs[0].variable,'result');
  for(const n of nodes.filter(n=>n.data.type==='llm'))for(const prompt of n.data.prompt_template){
   for(const ref of prompt.text.matchAll(/\{\{#([^.]+)\.([^#]+)#\}\}/g)){assert.ok(ids.has(ref[1]));if(ref[1]==='start')assert.ok(keys.includes(ref[2]));}
  }
 }
});

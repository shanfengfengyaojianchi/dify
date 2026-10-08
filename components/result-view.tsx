import {Fragment} from 'react';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
export type ResultTable={columns:string[];rows:string[][]};
export function DataTable({table}:{table:ResultTable}){
 return <div className="result-table"><Table><TableHeader><TableRow>{table.columns.map((c,i)=><TableHead key={i}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{table.rows.map((r,i)=><TableRow key={i}>{r.map((c,j)=><TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}
function inline(text:string){return text.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:<Fragment key={i}>{part}</Fragment>);}
export function ResultView({text,table}:{text:string;table?:ResultTable|null}){
 if(table)return <><h3 className="result-title">资料提取结果</h3><DataTable table={table}/><p className="table-note">缺失信息保留为“待确认”。下载 CSV 可继续整理。</p></>;
 const lines=text.split('\n');const blocks=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(line.startsWith('|')&&lines[i+1]?.match(/^\|[\s:|\-]+\|?$/)){
   const split=(s:string)=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
   const columns=split(line);const rows:string[][]=[];i+=2;
   while(i<lines.length&&lines[i].startsWith('|')){rows.push(split(lines[i]));i++;}i--;
   blocks.push(<DataTable key={i} table={{columns,rows}}/>);continue;
  }
  if(/^#{1,4}\s/.test(line)){const level=line.match(/^#+/)![0].length;const content=inline(line.replace(/^#+\s/,''));blocks.push(level===1?<h3 className="result-title" key={i}>{content}</h3>:<h4 key={i}>{content}</h4>);}
  else if(/^[-*]\s/.test(line))blocks.push(<p className="result-bullet" key={i}><span aria-hidden="true">•</span>{inline(line.slice(2))}</p>);
  else blocks.push(<p key={i}>{inline(line)}</p>);
 }
 return <>{blocks}</>;
}

import {tools} from '@/lib/catalog';
import {configuration} from '@/lib/core.mjs';
import {runtimeEnv} from '@/lib/server-env';
export const dynamic='force-dynamic';
export async function GET(){
 const env=runtimeEnv();
 const states=Object.fromEntries(tools.map(t=>[t.id,{configured:!!configuration(t.id,env).key}]));
 return Response.json({tools:states,configuredCount:Object.values(states).filter(s=>s.configured).length},{headers:{'Cache-Control':'no-store'}});
}

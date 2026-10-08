import { env } from 'cloudflare:workers';
import { tools } from './catalog';
import { keyName } from './core.mjs';
export function runtimeEnv(): Record<string,string|undefined> {
 const keys = ['DIFY_API_BASE_URL','DIFY_API_KEY',...tools.map(t=>keyName(t.id))];
 const bindings=env as unknown as Record<string,unknown>;
 return Object.fromEntries(keys.map(k=>[k,typeof bindings[k]==='string'?bindings[k] as string:process.env[k]]));
}

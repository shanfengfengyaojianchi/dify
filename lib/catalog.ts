import catalog from './catalog.json';
export type ToolField = {key:string;label:string;type:string;required:boolean;placeholder?:string;options?:string[]};
export type Tool = {id:string;name:string;category:string;icon:string;description:string;output:string;color:string;fields:ToolField[];example:Record<string,string>;instruction:string};
export const tools = catalog as unknown as Tool[];
export const categories = ['全部工具','内容创作','营销销售','办公效率'];
export const getTool = (id:string) => tools.find(tool => tool.id === id);

import { NextRequest,NextResponse } from 'next/server';
import { currentUser,sameOrigin,type Actor } from './security';
export function success(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function fail(err:unknown,status=400){const message=err instanceof Error?err.message:typeof err==='string'?err:'Unable to process request';return success({error:message.slice(0,300)},status);}
export async function auth(req:NextRequest,adminOnly=false):Promise<Actor>{const actor=await currentUser();if(!actor)throw Error('Login required');if(adminOnly&&actor.role!=='admin')throw Error('Admin access required');if(req.method!=='GET'&&!sameOrigin(req))throw Error('Invalid request origin');return actor;}
export function s(x:unknown,max=1000){if(x==null)return '';if(typeof x!=='string'&&typeof x!=='number')throw Error('Invalid field type');return String(x).trim().slice(0,max);}
export function amount(x:unknown){const n=Number(x);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Invalid price');return Math.round(n*100)/100;}
export function bool(x:string){return x.toLowerCase()==='true';}

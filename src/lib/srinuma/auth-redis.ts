import { Redis } from '@upstash/redis';
let client: Redis | null = null;
export function authRedis(): Redis {
 if(!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN){
  throw new Error('Redis credentials are required for secure account authentication');
 }
 return client ??= Redis.fromEnv();
}
export function revokedKey(id:string){return `srinuma:auth:revoked:${id}`;}

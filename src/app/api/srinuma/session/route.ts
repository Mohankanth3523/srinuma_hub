import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { authRedis } from '@/lib/srinuma/auth-redis';
import {
  checkAdminCredentials, checkEmployeeCredentials, clearLoginCookie,
  createSession, currentUser, setLoginCookie, renewLoginIfNeeded,
  sameOrigin, type Actor,
} from '@/lib/srinuma/security';
import { success, fail } from '@/lib/srinuma/api';

// Shared Upstash rate limit rather than a per-process Map. This is a bounded
// 15-minute window per normalized username (including nonexistent accounts).
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

export async function GET() {
  const user = await currentUser();
  if (user) await renewLoginIfNeeded(user);
  return success({ loggedIn: !!user, user });
}

export async function POST(req: NextRequest) {
  if (!req.headers.get('origin') || !sameOrigin(req)) return fail('Invalid request origin', 403);
  try {
    const body = await req.json() as {username?: unknown; password?: unknown};
    if (typeof body.username !== 'string' || typeof body.password !== 'string' ||
        body.password.length > 200) return fail('Invalid credentials', 400);
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z][a-z0-9._-]{2,40}$/.test(username) || !body.password) {
      return fail('Invalid credentials', 400);
    }

    const redis = authRedis();
    const loginKey = 'srinuma:auth:login:attempt:' +
      createHash('sha256').update(username).digest('hex');
    const attempts = await redis.incr(loginKey);
    if (attempts === 1) await redis.expire(loginKey, WINDOW_SECONDS);
    if (attempts > MAX_ATTEMPTS) return fail('Too many login attempts. Try again in 15 minutes.', 429);

    let user: Actor | null = null;
    if (await checkAdminCredentials(username, body.password)) {
      user = {id:'srinuma',username:'srinuma',name:'Srinuma Admin',role:'admin'};
    } else if (username !== 'srinuma') {
      user = await checkEmployeeCredentials(username, body.password);
    }
    if (!user) return fail('Username or password incorrect', 401);
    await redis.del(loginKey);
    await setLoginCookie(createSession(user));
    return success({loggedIn:true,user});
  } catch (e) {
    console.error('SRINUMA login temporarily unavailable', e instanceof Error ? e.message : 'Login error');
    return fail('Login temporarily unavailable', 503);
  }
}

export async function DELETE(req: NextRequest) {
  if (!req.headers.get('origin') || !sameOrigin(req)) return fail('Invalid origin', 403);
  await clearLoginCookie();
  return success({loggedIn:false});
}

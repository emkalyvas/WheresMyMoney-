import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../context';
import type { ResolvedSession } from './sessions';

export const SESSION_COOKIE = 'wmm_session';
/** Custom header required on cookie-authenticated writes; cross-site forms/fetches can't set it without CORS. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'wmm';

declare module 'fastify' {
  interface FastifyRequest {
    session: ResolvedSession | null;
    sessionToken: string | null;
    authVia: 'cookie' | 'bearer' | null;
  }
  interface FastifyContextConfig {
    /** Route is reachable without a session. */
    public?: boolean;
    /** Route is reachable before first-run setup is complete. */
    allowDuringSetup?: boolean;
  }
}

export function registerAuth(app: FastifyInstance, ctx: AppContext) {
  app.decorateRequest('session', null);
  app.decorateRequest('sessionToken', null);
  app.decorateRequest('authVia', null);

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const cfg = req.routeOptions.config ?? {};

    if (!ctx.passwords.isSet() && !cfg.allowDuringSetup) {
      return reply.code(409).send({ success: false, error: 'Setup required', code: 'SETUP_REQUIRED' });
    }

    const days = ctx.settings.get().security.sessionDays;
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const cookie = req.cookies[SESSION_COOKIE] ?? null;

    if (bearer) {
      req.session = ctx.sessions.resolve(bearer, days);
      req.sessionToken = req.session ? bearer : null;
      req.authVia = req.session ? 'bearer' : null;
    } else if (cookie) {
      req.session = ctx.sessions.resolve(cookie, days);
      req.sessionToken = req.session ? cookie : null;
      req.authVia = req.session ? 'cookie' : null;
    }

    if (cfg.public) return;
    if (!req.session) return unauthorized(reply);

    if (req.authVia === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers[CSRF_HEADER] !== CSRF_VALUE) {
        return reply.code(403).send({ success: false, error: 'Forbidden', code: 'CSRF' });
      }
    }
  });
}

export function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
}

export function setSessionCookie(req: FastifyRequest, reply: FastifyReply, token: string, days: number) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: req.protocol === 'https',
    maxAge: days * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

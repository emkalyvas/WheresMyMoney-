import type { FastifyInstance } from 'fastify';
import { type AuthStatus, changePasswordSchema, loginSchema, setupSchema } from '@wmm/shared';
import crypto from 'node:crypto';
import { clearSessionCookie, setSessionCookie } from '../auth/plugin';
import type { AppContext } from '../context';

const LOGIN_LIMIT = { max: 10, timeWindow: '15 minutes' };

export function authRoutes(app: FastifyInstance, ctx: AppContext) {
  const days = () => ctx.settings.get().security.sessionDays;

  app.get('/api/auth/status', { config: { public: true, allowDuringSetup: true } }, async (req): Promise<AuthStatus> => {
    const setupRequired = !ctx.passwords.isSet();
    return { required: true, authenticated: !!req.session, setupRequired };
  });

  /**
   * v1-compatible login used by integrations (e.g. TimologioPlus):
   * POST { password } → { success, token }; send the token as `Authorization: Bearer <token>`.
   */
  app.post(
    '/api/auth/login',
    { config: { public: true, rateLimit: LOGIN_LIMIT } },
    async (req, reply) => {
      const { password } = loginSchema.parse(req.body);
      if (!(await ctx.passwords.verify(password))) {
        return reply.code(401).send({ success: false, error: 'Invalid password' });
      }
      const token = ctx.sessions.create('api', days(), req.headers['user-agent']);
      return { success: true, token };
    },
  );

  /** Browser login: sets an httpOnly session cookie; the token is never exposed to scripts. */
  app.post(
    '/api/auth/session',
    { config: { public: true, rateLimit: LOGIN_LIMIT } },
    async (req, reply) => {
      const { password } = loginSchema.parse(req.body);
      if (!(await ctx.passwords.verify(password))) {
        return reply.code(401).send({ success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' });
      }
      const token = ctx.sessions.create('web', days(), req.headers['user-agent']);
      setSessionCookie(req, reply, token, days());
      return { success: true };
    },
  );

  app.post('/api/auth/logout', { config: { public: true } }, async (req, reply) => {
    if (req.sessionToken) ctx.sessions.revoke(req.sessionToken);
    clearSessionCookie(reply);
    return { success: true };
  });

  app.get('/api/auth/sessions', async (req) => ctx.sessions.list(req.session?.id ?? null));

  app.delete<{ Params: { id: string } }>('/api/auth/sessions/:id', async (req) => {
    ctx.sessions.revokeByPublicId(req.params.id);
    return { success: true };
  });

  app.post('/api/auth/sessions/revoke-others', async (req) => {
    ctx.sessions.revokeAllExcept(req.session?.id ?? null);
    return { success: true };
  });

  app.post('/api/auth/password', { config: { rateLimit: LOGIN_LIMIT } }, async (req, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    if (!(await ctx.passwords.verify(currentPassword))) {
      return reply.code(400).send({ success: false, error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });
    }
    await ctx.passwords.set(newPassword);
    // Everything else (including integrations) must log in again with the new password.
    ctx.sessions.revokeAllExcept(req.session?.id ?? null);
    return { success: true };
  });

  // -------------------------------------------------------------------------
  // First-run setup
  // -------------------------------------------------------------------------

  app.get('/api/setup/status', { config: { public: true, allowDuringSetup: true } }, async () => ({
    setupRequired: !ctx.passwords.isSet(),
    importedFromEnv: ctx.settings.wasImportedFromEnv(),
  }));

  app.post(
    '/api/setup',
    { config: { public: true, allowDuringSetup: true, rateLimit: LOGIN_LIMIT } },
    async (req, reply) => {
      if (ctx.passwords.isSet() || !ctx.setup.code) {
        return reply.code(409).send({ success: false, error: 'Setup already completed', code: 'SETUP_DONE' });
      }
      const body = setupSchema.parse(req.body);
      const expected = Buffer.from(ctx.setup.code);
      const given = Buffer.from(body.setupCode.replace(/\s/g, '').toUpperCase());
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        return reply.code(400).send({ success: false, error: 'Invalid setup code', code: 'INVALID_SETUP_CODE' });
      }
      await ctx.passwords.set(body.password);
      ctx.setup.code = null;
      if (body.timezone && isValidTimezone(body.timezone) && !ctx.settings.wasImportedFromEnv()) {
        ctx.settings.updateSection('general', { ...ctx.settings.get().general, timezone: body.timezone });
      }
      const token = ctx.sessions.create('web', days(), req.headers['user-agent']);
      setSessionCookie(req, reply, token, days());
      return { success: true };
    },
  );
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

import express from 'express';
import { timingSafeEqual, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { Config } from './config.js';
import { requestSchema, ServiceError, type VerifyRequest } from './contracts.js';
import { createVerifier, ready } from './service.js';

type Verifier = (request: VerifyRequest) => Promise<unknown>;
export function createApp(config: Config, verify: Verifier = createVerifier(config)) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/v1/health', (_req, res) => res.status(ready(config) ? 200 : 503).json({
    service: 'Facet', ready: ready(config), mode: config.demo ? 'demo' : 'live',
    capabilities: { web: true, x: true, reddit: true, media_forensics: false, historical_as_of: false },
    configured: { glasser: Boolean(config.glasserKey), model: Boolean(config.modelKey) },
  }));
  app.get('/openapi.json', (_req, res) => res.sendFile(resolve('openapi.json')));
  app.use(express.static(resolve('public'), { index: 'index.html' }));
  let active = 0;
  app.post('/v1/verify', async (req, res) => {
    const supplied = req.get('X-Origin-Key') ?? '';
    const digest = (s: string) => createHash('sha256').update(s).digest();
    if (!timingSafeEqual(digest(supplied), digest(config.originKey))) {
      res.status(401).json({ error: { code: 'gateway_required', message: 'Use the pay.sh gateway to access this endpoint.' } }); return;
    }
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'invalid_request', message: 'Invalid verification request.', details: parsed.error.issues } }); return;
    }
    if (active >= 4) {
      res.set('Retry-After', '10').status(503).json({ error: { code: 'busy', message: 'Verification capacity is full. Try again later.' } }); return;
    }
    active++;
    try { res.json(await verify(parsed.data)); }
    catch (error) {
      const known = error instanceof ServiceError;
      res.status(known ? error.status : 500).json({ error: {
        code: known ? error.code : 'verification_failed',
        message: known ? error.message : 'Verification failed. No verdict was accepted.',
      } });
    } finally { active--; }
  });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: { code: 'invalid_body', message: 'Provide a JSON body no larger than 16 KB.' } });
  });
  return app;
}

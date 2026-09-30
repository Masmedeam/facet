import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const env = { ...process.env, ORIGIN_API_KEY: process.env.ORIGIN_API_KEY || randomBytes(32).toString('hex'),
  UPSTREAM_BASE_URL: 'http://127.0.0.1:3000/', PORT: '3000', HOST: '127.0.0.1',
  DEMO_MODE: process.env.DEMO_MODE || 'true' };
const origin = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { env, stdio: 'inherit' });
let gateway: ReturnType<typeof spawn> | undefined;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  origin.kill('SIGTERM'); gateway?.kill('SIGTERM');
  setTimeout(() => { origin.kill('SIGKILL'); gateway?.kill('SIGKILL'); }, 2000).unref();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop());
origin.on('exit', (code) => stop(code ?? 1));
for (let i = 0; i < 50 && !stopping; i++) {
  try {
    const response = await fetch(`${env.UPSTREAM_BASE_URL}v1/health`);
    if (response.status === 200 || response.status === 503) break;
  } catch { /* Wait for origin startup. */ }
  await new Promise((r) => setTimeout(r, 100));
}
if (!stopping) {
  gateway = spawn(resolve('node_modules/.bin/pay'), ['--sandbox', 'gate', 'api', 'paywall.sandbox.yml', '--bind', '127.0.0.1:1402', '--openapi', 'openapi.json'], { env, stdio: 'inherit' });
  gateway.on('error', () => stop(1));
  gateway.on('exit', (code) => stop(code ?? 1));
  console.log('Paid gateway: http://127.0.0.1:1402/v1/verify');
}

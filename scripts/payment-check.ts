import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const live = process.argv.includes('--live-retrieval');
const env = { ...process.env, ORIGIN_API_KEY: randomBytes(32).toString('hex'),
  UPSTREAM_BASE_URL: 'http://127.0.0.1:3100/', PORT: '3100', HOST: '127.0.0.1', DEMO_MODE: live ? 'false' : 'true' };
const processes: ReturnType<typeof spawn>[] = [];
async function wait(url: string, seconds = 30) {
  for (let i = 0; i < seconds * 5; i++) {
    try { const res = await fetch(url); if (res.ok) return; } catch { /* Waiting for process. */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Service did not become ready: ${url}`);
}
try {
  processes.push(spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { env, stdio: 'inherit' }));
  await wait(`${env.UPSTREAM_BASE_URL}v1/health`);
  processes.push(spawn(resolve('node_modules/.bin/pay'), ['--sandbox', 'gate', 'api', 'paywall.sandbox.yml', '--bind', '127.0.0.1:1502', '--openapi', 'openapi.json'], { env, stdio: 'inherit' }));
  await wait('http://127.0.0.1:1502/__402/health', 60);
  const body = JSON.stringify(live ? {
    claim: 'FundingPips has never denied a single payout.',
    source_url: 'https://x.com/risers343/status/2033028565550379505', sources: ['x'],
  } : { claim: 'This product exports all attachments.', sources: ['web'] });
  const unpaid = await fetch('http://127.0.0.1:1502/v1/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  console.log(`Unpaid request: HTTP ${unpaid.status}`);
  if (unpaid.status !== 402) throw new Error('Expected a real HTTP 402 challenge.');
  const { stdout } = await exec(resolve('node_modules/.bin/pay'), [
    '--sandbox', 'curl', '-sS', '-X', 'POST', 'http://127.0.0.1:1502/v1/verify',
    '-H', 'Content-Type: application/json', '-d', body,
  ], { env, timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });
  const result = JSON.parse(stdout);
  if (!result.id) throw new Error(`Paid request failed: ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ payment_network: 'sandbox (no real USDC)', mode: result.mode,
    verdict: result.verdict, summary: result.summary, evidence_count: result.evidence.length,
    citations: result.citations.length, research: result.research, billing: result.billing }, null, 2));
} finally {
  for (const child of processes.reverse()) {
    child.kill('SIGTERM');
    if (child.exitCode === null) {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
      clearTimeout(timeout);
    }
  }
}

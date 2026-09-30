import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

// New Worker service needs its own stable challenge secret; preserve it privately for subsequent uploads.
const path = '.claimcheck/facet-challenge-secret.txt';
let challenge: string;
try { challenge = await readFile(path, 'utf8'); }
catch { challenge = randomBytes(32).toString('hex'); await writeFile(path, challenge, { flag: 'wx', mode: 0o600 }); }
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/deploy-secrets.ts'], {
  env: { ...process.env, PAY_MPP_CHALLENGE_SECRET: challenge }, stdio: 'inherit',
});
await new Promise<void>((done, reject) => child.on('exit', (code) => code === 0 ? done() : reject(new Error('Facet secret configuration failed'))));

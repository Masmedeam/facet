import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Signer } from '@solana/pay-kit';

const wallet = await readFile('.claimcheck/wallet/merchant.json', 'utf8');
const signer = await Signer.json(wallet);
const secrets = {
  GLASSER_API_KEY: process.env.GLASSER_API_KEY,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_API_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  PAY_OPERATOR_KEYPAIR: wallet,
  PAY_PAYMENT_RECIPIENT: signer.pubkey,
  PAY_MPP_CHALLENGE_SECRET: process.env.PAY_MPP_CHALLENGE_SECRET,
};
if (Object.values(secrets).some((value) => !value)) throw new Error('Missing deployment secrets');
const child = spawn('npx', ['wrangler', 'secret', 'bulk'], { stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.end(JSON.stringify(secrets));
await new Promise<void>((resolve, reject) => child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Secret upload failed'))));
console.log('Secrets uploaded without printing values. Preserve PAY_MPP_CHALLENGE_SECRET across deployments.');

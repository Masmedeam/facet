import { readFile, writeFile } from 'node:fs/promises';

// pay-kit 0.12.0 uses confirmed simulation but omits broadcast commitment.
// Retain preflight checks; align broadcast preflight to the same commitment.
const path = 'node_modules/@solana/pay-kit/dist/index.js';
const original = await readFile(path, 'utf8');
const target = 'params: [base64Tx, { encoding: "base64", skipPreflight: false }]';
const replacement = 'params: [base64Tx, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }]';
if (original.includes(target)) {
  await writeFile(path, original.replaceAll(target, replacement));
  console.log('Applied pay-kit confirmed preflight compatibility patch.');
} else if (!original.includes(replacement)) {
  throw new Error('pay-kit implementation changed; review/remove preflight compatibility patch.');
}

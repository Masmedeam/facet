import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { Signer } from '@solana/pay-kit';

// Local merchant signing material. Exclusive creation prevents accidental replacement.
await mkdir('.claimcheck/wallet', { recursive: true, mode: 0o700 });
let bytes: number[];
try {
  bytes = JSON.parse(await readFile('.claimcheck/wallet/merchant.json', 'utf8'));
} catch {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const publicBytes = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  bytes = [...seed, ...publicBytes];
  await writeFile('.claimcheck/wallet/merchant.json', JSON.stringify(bytes), { mode: 0o600, flag: 'wx' });
}
const signer = await Signer.bytes(bytes);
console.log(`Revenue wallet: ${signer.pubkey}`);
console.log('Private backup: .claimcheck/wallet/merchant.json (ignored by git; never publish)');

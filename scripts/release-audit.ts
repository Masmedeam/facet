import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const candidates = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
let env = '';
try { env = await readFile('.env', 'utf8'); } catch {}
const secrets = env.split(/\r?\n/).flatMap((line) => {
  const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!match || !/KEY|SECRET|TOKEN|PASSWORD|REDEEM/.test(match[1]!)) return [];
  const value = match[2]!.trim().replace(/^['"]|['"]$/g, '');
  return value.length >= 16 ? [value] : [];
});
const issues: string[] = [];
for (const path of candidates) {
  if (/^(node_modules|dist|\.claimcheck|\.wrangler|research-data|broad-research-data)\//.test(path) || /^\.env(?:$|\.)/.test(path) && path !== '.env.example') issues.push(`${path}: private/generated file included`);
  const bytes = await readFile(path);
  if (secrets.some((value) => bytes.includes(Buffer.from(value)))) issues.push(`${path}: exact local credential found`);
  if (/\.(webp|png|woff2)$/.test(path)) continue;
  const text = bytes.toString('utf8');
  if (/(?:gl_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)) issues.push(`${path}: credential-like value found`);
  if (path !== 'scripts/release-audit.ts' && /\/Users\/[^\s/]+\/|app\.glasser\.ai\/runs\//.test(text)) issues.push(`${path}: private workspace path or run link found`);
  const privateEndpoint = /^AZURE_OPENAI_ENDPOINT=(.*)$/m.exec(env)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (privateEndpoint && text.includes(privateEndpoint)) issues.push(`${path}: local private model endpoint found`);
  if (path.endsWith('.md')) for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
    const target = match[1]!.split('#')[0]!;
    if (!target || /^(https?:|mailto:|\/)/.test(target)) continue;
    if (!existsSync(resolve(dirname(path), target))) issues.push(`${path}: broken local link ${target}`);
  }
}
const requiredIgnored = ['.env', '.dev.vars', '.claimcheck/wallet/merchant.json', '.wrangler/state/example', 'node_modules/example', 'dist/example', 'broad-research-data/example.json', 'docs/research/original-market-research.md'];
for (const path of requiredIgnored) {
  try { execFileSync('git', ['check-ignore', '-q', path]); } catch { issues.push(`${path}: ignore rule missing`); }
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log(`Release audit passed: ${candidates.length} publishable files; local credential matching, secret patterns, private paths, ignore rules and Markdown links checked.`);

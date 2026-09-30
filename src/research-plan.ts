import { isIP } from 'node:net';
import type { Evidence, VerifyRequest } from './contracts.js';

export function fetchableUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    // Provider-backed retrieval only; never send local infrastructure URLs to a crawler.
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
        || isIP(host) || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
        || host === 'metadata.google.internal' || (url.port && !['80', '443'].includes(url.port))) return undefined;
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

const stopWords = new Set('the a an is are was were has have had that this these those according to of in on at for and or with by from it its both all never always almost certainly because no any true false proves proof contains'.split(' '));
export function planQueries(request: VerifyRequest) {
  const words = request.claim.replace(/[@#]/g, '').match(/[\p{L}\p{N}][\p{L}\p{N}.'’/-]*/gu) ?? [];
  const neutral = words.filter((w) => !stopWords.has(w.toLowerCase())).slice(0, 22).join(' ').slice(0, 240);
  const main = neutral || request.claim.slice(0, 240);
  return { discovery: main, counterevidence: `${main} exceptions limitations correction evidence`.slice(0, 300) };
}

export function pagePriority(item: Pick<Evidence, 'url'>): number {
  const host = new URL(item.url).hostname;
  if (host.endsWith('.gov') || host.endsWith('.gov.uk') || host.endsWith('.edu')) return 5;
  if (host === 'apple.com' || host.endsWith('.apple.com') || host.endsWith('.boeing.com') || host === 'boeing.mediaroom.com') return 4;
  if (host === 'doi.org' || host === 'pubmed.ncbi.nlm.nih.gov' || host === 'arxiv.org') return 4;
  if (/facebook\.com$|instagram\.com$|youtube\.com$|tiktok\.com$/.test(host)) return 0;
  return 2;
}

export function selectPages(evidence: Evidence[], sourceUrl?: string, limit = 4): string[] {
  const candidates = evidence.filter((e) => e.source === 'web' && fetchableUrl(e.url))
    .sort((a, b) => pagePriority(b) - pagePriority(a));
  const explicit = sourceUrl && fetchableUrl(sourceUrl);
  const urls = new Set<string>();
  const hosts = new Map<string, number>();
  if (explicit && !/(^|\.)(x\.com|twitter\.com|reddit\.com)$/.test(new URL(explicit).hostname)) urls.add(explicit);
  for (const item of candidates) {
    if (urls.size >= limit) break;
    const url = fetchableUrl(item.url)!;
    const host = new URL(url).hostname.replace(/^www\./, '');
    if ((hosts.get(host) ?? 0) >= 2) continue;
    urls.add(url); hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  return [...urls].slice(0, limit);
}

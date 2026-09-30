import { writeFile } from 'node:fs/promises';

// Copy the catalog's published brand assets locally; do not depend on third-party image requests at render time.
const assets = {
  'serper.webp': 'providers-serper-60-2782a08d73a9.webp',
  'exa.webp': 'providers-exa-60-24931b58325c.webp',
  'tikhub.webp': 'providers-tikhub-60-7c651d16b8d9.webp',
  'scrapecreators.svg': 'providers-scrapecreators-4fc1d669bb85.svg',
  'dataforseo.webp': 'providers-dataforseo-60-5297665f3b30.webp',
  'brightdata.webp': 'providers-brightdata-60-09da02fca0ca.webp',
  'apify.svg': 'providers-apify-17aedf06ae9c.svg',
  'serpapi.webp': 'providers-serpapi-60-fb3c53398fe1.webp',
  'grok.svg': 'agents-grok-9175fc90c226.svg',
  'ahrefs.svg': 'providers-ahrefs-109324eecbaf.svg',
  'semrush.svg': 'providers-semrush-c71deb8dd523.svg',
  'builtwith.webp': 'providers-builtwith-60-79068bcf4db1.webp',
  'predictleads.svg': 'providers-predictleads-37702a485177.svg',
  'pdl.webp': 'providers-pdl-60-7c1d34daefa3.webp',
  'crustdata.webp': 'providers-crustdata-60-ae72f1171b03.webp',
  'youtube.svg': 'topics-youtube-api-b254265da634.svg',
  'tiktok.svg': 'topics-tiktok-api-9406a5f362e6.svg',
  'instagram.svg': 'topics-instagram-api-351a4fdfc466.svg',
  'linkedin.svg': 'topics-linkedin-api-fcc79e62e6b0.svg',
};
for (const [name, asset] of Object.entries(assets)) {
  const response = await fetch(`https://glasser.ai/_images/${asset}`);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Invalid brand asset: ${name}`);
  await writeFile(`public/icons/${name}`, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${name} from Glasser's public catalog`);
}

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_OPENAI_ENDPOINT to your Azure inference URL.');
const base = endpoint.replace(/\/$/, '');
const key = process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_API_KEY;
if (!key) throw new Error('Set AZURE_OPENAI_API_KEY or AZURE_API_KEY.');
const target = process.argv[2] || `${base}/models`;
if (new URL(target).origin !== new URL(base).origin) throw new Error('Model discovery URL must use the configured Azure origin.');
const response = await fetch(target, {
  headers: { 'api-key': key }, signal: AbortSignal.timeout(30_000),
});
console.log(`Azure model discovery HTTP ${response.status}`);
const data = await response.json() as { data?: { id: string }[]; error?: { code?: string; message?: string } };
console.log(JSON.stringify(data.data?.map((m) => m.id) ?? data.error ?? data, null, 2));

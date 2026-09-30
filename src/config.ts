import { z } from 'zod';

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const schema = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default('127.0.0.1'),
    DEMO_MODE: z.enum(['true', 'false']).default('false'),
    GLASSER_BIN: z.string().default('glasser'),
    GLASSER_API_KEY: z.string().default(''),
    GLASSER_API_BASE_URL: z.url().default('https://api.glasser.ai'),
    DATA_PROVIDER: z.enum(['glasser', 'direct']).default('glasser'),
    SERPER_API_KEY: z.string().default(''),
    EXA_API_KEY: z.string().default(''),
    TIKHUB_API_KEY: z.string().default(''),
    SCRAPECREATORS_API_KEY: z.string().default(''),
    MODEL_API_KEY: z.string().default(''),
    MODEL_BASE_URL: z.url().default('https://api.openai.com/v1'),
    MODEL_NAME: z.string().default('gpt-4.1-mini'),
    MODEL_PROVIDER: z.enum(['azure', 'openai']).default('azure'),
    AZURE_OPENAI_API_KEY: z.string().optional(),
    AZURE_API_KEY: z.string().optional(),
    AZURE_OPENAI_ENDPOINT: z.url().optional(),
    AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
    AZURE_OPENAI_API_VERSION: z.string().optional(),
    MODEL_INPUT_USD_PER_MILLION: z.coerce.number().nonnegative().optional(),
    MODEL_CACHED_INPUT_USD_PER_MILLION: z.coerce.number().nonnegative().optional(),
    MODEL_OUTPUT_USD_PER_MILLION: z.coerce.number().nonnegative().optional(),
    SERVICE_FEE_USD: z.coerce.number().nonnegative().default(0.005),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86400).default(900),
    CACHE_DIR: z.string().default('.claimcheck/cache'),
    ORIGIN_API_KEY: z.string().min(24, 'Set ORIGIN_API_KEY to a random shared secret (at least 24 characters).'),
  });
  const parsed = schema.parse(env);
  return {
    port: parsed.PORT, host: parsed.HOST, demo: parsed.DEMO_MODE === 'true',
    glasserBin: parsed.GLASSER_BIN, glasserKey: parsed.GLASSER_API_KEY,
    glasserBase: parsed.GLASSER_API_BASE_URL.replace(/\/$/, ''),
    dataProvider: parsed.DATA_PROVIDER,
    directKeys: { serper: parsed.SERPER_API_KEY, exa: parsed.EXA_API_KEY, tikhub: parsed.TIKHUB_API_KEY, scrapecreators: parsed.SCRAPECREATORS_API_KEY },
    modelKey: parsed.AZURE_OPENAI_API_KEY || parsed.AZURE_API_KEY || parsed.MODEL_API_KEY,
    modelBase: (parsed.AZURE_OPENAI_ENDPOINT || parsed.MODEL_BASE_URL).replace(/\/$/, ''),
    modelName: parsed.AZURE_OPENAI_DEPLOYMENT || parsed.MODEL_NAME,
    modelProvider: parsed.MODEL_PROVIDER,
    azureVersion: parsed.AZURE_OPENAI_API_VERSION,
    originKey: parsed.ORIGIN_API_KEY,
    inputRate: parsed.MODEL_INPUT_USD_PER_MILLION,
    cachedInputRate: parsed.MODEL_CACHED_INPUT_USD_PER_MILLION,
    outputRate: parsed.MODEL_OUTPUT_USD_PER_MILLION,
    serviceFee: parsed.SERVICE_FEE_USD,
    cacheTtl: parsed.CACHE_TTL_SECONDS,
    cacheDir: parsed.CACHE_DIR,
  };
}
export type Config = ReturnType<typeof loadConfig>;

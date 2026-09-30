import { assess } from '../src/model.js';
import { loadConfig } from '../src/config.js';
import { requestSchema } from '../src/contracts.js';

const config = loadConfig({ ...process.env, ORIGIN_API_KEY: 'local-smoke-test-secret-at-least-24' });
const result = await assess(requestSchema.parse({ claim: 'All data, including attachments, can be exported.' }), [{
  id: 'e1', source: 'web', url: 'https://example.com/fictional-policy',
  text: 'Fictional test policy: Core records can be exported. Attachments cannot be exported.',
  retrieved_at: new Date().toISOString(), scope: 'post',
}], config);
console.log(JSON.stringify({ model: config.modelName, verdict: result.verdict, citations: result.citations.length, summary: result.summary }, null, 2));

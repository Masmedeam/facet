import type { Assessment, Evidence, VerifyRequest } from './contracts.js';

export function demoResult(request: VerifyRequest) {
  const evidence: Evidence[] = [{
    id: 'e1', source: 'web', url: 'https://example.com/fictional-export-policy',
    retrieved_at: new Date().toISOString(), text: 'Fictional fixture: Core records can be exported. Attachments are excluded.',
    scope: 'post',
  }];
  const assessment: Assessment = {
    verdict: 'insufficient_evidence',
    summary: 'DEMO ONLY: This response demonstrates the paid API format. The supplied claim was not researched.',
    atomic_claims: [{ claim: request.claim, verdict: 'insufficient_evidence', explanation: 'Demo mode uses fictional evidence, not a real investigation.', evidence_ids: [] }],
    citations: [], limitations: ['Fictional fixture. Do not use this response to make factual decisions.'],
    next_steps: ['Configure Glasser and a model provider, then disable DEMO_MODE.'],
  };
  return { evidence, assessment, runs: [], warnings: ['DEMO MODE: no paid provider or model calls were made.'] };
}

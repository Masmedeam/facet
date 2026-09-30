const results = document.querySelector('#benchmark-results');
const filter = document.querySelector('#benchmark-filter');
if (results && filter) {
  fetch('/benchmark.json').then(async (response) => {
    if (!response.ok) throw new Error('Dataset unavailable');
    const dataset = await response.json();
    function render() {
      const rows = dataset.cases.filter((item) => filter.value === 'all' || (filter.value === 'mismatch' ? !item.expected_match && item.response.verdict : (item.response.verdict ?? 'client_failure') === filter.value));
      results.replaceChildren();
      document.querySelector('#benchmark-count').textContent = `${rows.length} results`;
      for (const item of rows) {
        const row = document.createElement('details');
        row.className = 'benchmark-row';
        const heading = document.createElement('summary');
        const verdict = document.createElement('span');
        verdict.className = `result-badge ${item.response.verdict === 'supported' ? 'supported' : item.response.verdict === 'refuted' ? 'refuted' : item.response.verdict === 'mixed' ? 'mixed' : 'unresolved'}`;
        verdict.textContent = (item.response.verdict ?? 'client_failure').replaceAll('_', ' ');
        const claim = document.createElement('span');
        claim.textContent = item.claim;
        const topic = document.createElement('span');
        topic.className = 'benchmark-topic';
        topic.textContent = item.topic;
        heading.append(verdict, claim, topic);
        row.append(heading);
        const content = document.createElement('div');
        content.className = 'benchmark-detail';
        function paragraph(text) { const p = document.createElement('p'); p.textContent = text; content.append(p); }
        function link(text, url) { const a = document.createElement('a'); a.textContent = text; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; content.append(a); }
        paragraph(item.response.summary ?? 'The client/payment exchange did not return a usable assessment. No factual verdict was scored.');
        link('Original X question ↗', item.question_url);
        const embed = document.createElement('iframe');
        embed.className = 'benchmark-embed';
        embed.src = `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(item.question_url.split('/').at(-1))}&theme=light&dnt=true`;
        embed.title = `Original X question about ${item.topic}`;
        embed.loading = 'lazy';
        content.append(embed);
        paragraph(item.question.text);
        for (const bot of item.bot_replies) { link('Original Grok reply ↗', bot.url); paragraph(bot.text); }
        paragraph(`Reference expectation: ${item.expected.join(' / ')}. ${item.expected_match ? 'Label matched.' : 'Label did not match, or no result returned.'}`);
        paragraph(item.reference_basis);
        link('Reference source ↗', item.reference_url);
        for (const citation of item.response.citations ?? []) { const quote = document.createElement('blockquote'); quote.textContent = citation.quote; content.append(quote); if(citation.url) link('Retrieved source ↗', citation.url); }
        for (const limitation of [...(item.response.limitations ?? []), ...(item.response.warnings ?? [])]) paragraph(limitation);
        paragraph(`Quote audit: ${item.quote_audit.exact_matches}/${item.quote_audit.citations} exact matches. ${item.response.duration_ms ? `${(item.response.duration_ms / 1000).toFixed(1)}s research time.` : ''}`);
        if(item.response.settlement) link('Payment transaction ↗', `https://solscan.io/tx/${item.response.settlement}`);
        const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = JSON.stringify(item.request, null, 2); pre.append(code); content.append(pre);
        row.append(content); results.append(row);
      }
    }
    filter.addEventListener('change', render);
    render();
  }).catch(() => { results.textContent = 'Results could not load. Download /benchmark.json to inspect the dataset.'; });
}

let showcase;
document.querySelectorAll('.try-case').forEach((button) => {
  button.textContent = 'View tested input';
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', async () => {
    const existing = button.parentElement.querySelector('.tested-input');
    if (existing) {
      existing.hidden = !existing.hidden;
      button.setAttribute('aria-expanded', String(!existing.hidden));
      return;
    }
    try {
      if (!showcase) {
        const response = await fetch('/showcase.json');
        if (!response.ok) throw new Error('Examples unavailable');
        showcase = await response.json();
      }
      const item = showcase.cases.find((item) => item.slug === button.dataset.case);
      if (!item) throw new Error('Example unavailable');
      const preview = document.createElement('pre');
      preview.className = 'tested-input';
      preview.id = `input-${item.slug}`;
      const code = document.createElement('code');
      code.textContent = JSON.stringify(item.request, null, 2);
      preview.append(code);
      button.after(preview);
      button.setAttribute('aria-controls', preview.id);
      button.setAttribute('aria-expanded', 'true');
    } catch { button.textContent = 'Could not load input. Try again.'; }
  });
});

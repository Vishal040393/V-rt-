/* ============================================================
   papers.js — Demo paper data + DOI lookup via CrossRef API
   Exposes: getPaper(doi), DEMO_PAPERS
   ============================================================ */

const DEMO_PAPERS = {
  '10.48550/arxiv.1706.03762': {
    journal: 'arXiv Preprint · 2017',
    title: 'Attention Is All You Need',
    authors: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin',
    doi: '10.48550/arXiv.1706.03762',
    repScore: 89,
    badgeClass: 'bh', badgeText: 'High Replicability',
    outcomes: { replicated: 65, partial: 24, failed: 11, discussion: 18 },
    tags: ['transformers', 'NLP', 'self-attention', 'pytorch', 'tensorflow',
           'warmup-steps', 'label-smoothing', 'training-instability', 'batch-size'],
    contributors: [
      { name: 'Dr. E. Nakamura', role: 'ML Researcher, ETH Zürich', posts: 7, av: 'avt', letter: 'E' },
      { name: 'Ashwin Patel',    role: 'PhD Candidate, IIT Bombay',  posts: 5, av: 'ava', letter: 'A' },
      { name: 'Asel Nurlanova',  role: 'Author (Verified)',           posts: 4, av: 'avn', letter: 'A', verified: true },
    ],
    posts: [
      {
        id: 1, author: 'Dr. E. Nakamura', affil: 'ETH Zürich', av: 'avt', letter: 'E',
        outcome: 'replicated', date: 'Feb 12, 2025', ts: 1707696000,
        html: `Successfully reproduced the WMT English-German results in Table 2. Training a base model to 27.3 BLEU required the learning rate schedule in §5.3 — warmup steps are <strong>non-negotiable</strong>. My first three runs collapsed with a fixed LR.<br><br><blockquote>Warmup matters more than any other hyperparameter. Do not skip it.</blockquote>`,
        votes: 34,
        replies: [
          { author: 'Ashwin Patel', date: '2d later', body: 'Confirmed — warmup_steps=4000 critical. Any lower and training diverged after ~8k steps on TPUs.' }
        ],
      },
      {
        id: 2, author: 'Asel Nurlanova', affil: 'Paper Author', av: 'avn', letter: 'A',
        verified: true, outcome: 'discussion', date: 'Mar 1, 2025', ts: 1740787200,
        html: `Glad this is being discussed openly. One thing not in the paper: <strong>label smoothing ε=0.1</strong> was crucial for the final BLEU. We assumed it was standard but never documented it explicitly. Happy to answer questions here.`,
        votes: 89, replies: [],
      },
      {
        id: 3, author: 'M. Osei-Bonsu', affil: 'Univ. of Ghana', av: 'avr', letter: 'M',
        outcome: 'partial', date: 'Mar 18, 2025', ts: 1742256000,
        html: `Partial replication — within ~0.8 BLEU using PyTorch, but <strong>could not reproduce the multi-head ablations</strong> in Table 3. Six configurations tried; consistently ~1.5 BLEU lower. Possibly compute-dependent — I used 4×V100 vs. original 8×P100.<br><br>Math check: attention score is \\(\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V\\)`,
        votes: 21,
        replies: [
          { author: 'Dr. E. Nakamura', date: '1wk later', body: 'Same observation on ablations. P100s may have different matmul precision. Worth a follow-up study.' }
        ],
      },
    ],
  },

  '10.1177/0956797610383437': {
    journal: 'Psychological Science · 2010',
    title: 'Power Posing: Brief Nonverbal Displays Affect Neuroendocrine Levels',
    authors: 'Carney, Cuddy & Yap',
    doi: '10.1177/0956797610383437',
    repScore: 12,
    badgeClass: 'bl', badgeText: 'Low Replicability',
    outcomes: { replicated: 3, partial: 9, failed: 19, discussion: 14 },
    tags: ['psychology', 'hormones', 'testosterone', 'cortisol', 'p-hacking',
           'sample-size', 'embodiment', 'failed-replication'],
    contributors: [
      { name: 'Dr. R. Simonsohn', role: 'Methodology Critic, ESADE',      posts: 8, av: 'avr', letter: 'R' },
      { name: 'Priya Mehta',      role: 'PhD, Social Psych, U. Michigan', posts: 6, av: 'ava', letter: 'P' },
    ],
    posts: [
      {
        id: 1, author: 'Dr. R. Simonsohn', affil: 'ESADE', av: 'avr', letter: 'R',
        outcome: 'failed', date: 'Jan 8, 2024', ts: 1704672000,
        html: `Pre-registered replication (n=247, 10× original). Found <strong>zero effect on testosterone or cortisol</strong>. CIs don't overlap with original effect sizes.<br><br><blockquote>Original effect size d=0.68 for testosterone is implausible given salivary assay noise floor.</blockquote><br>The "felt power" self-report showed marginal effect (d=0.18) — insufficient to support neuroendocrine claims.`,
        votes: 112, replies: [],
      },
      {
        id: 2, author: 'Priya Mehta', affil: 'Univ. of Michigan', av: 'ava', letter: 'P',
        outcome: 'discussion', date: 'Feb 20, 2024', ts: 1708387200,
        html: `Original N=42 split across conditions means the study was underpowered even under optimistic assumptions.<br><br>Power calculation: \\(1 - \\beta = P(\\text{reject } H_0 \\mid H_1 \\text{ true})\\). At d=0.68 and n=21/group, power ≈ 0.52.<br><br><strong>This is a structural issue, not bad faith.</strong>`,
        votes: 78, replies: [],
      },
    ],
  },

  '10.1038/s41579-019-0222-3': {
    journal: 'Nature Reviews Microbiology · 2019',
    title: 'The Microbiota–Gut–Brain Axis',
    authors: "Cryan, O'Riordan, Cowan et al.",
    doi: '10.1038/s41579-019-0222-3',
    repScore: 54,
    badgeClass: 'bm', badgeText: 'Moderate Replicability',
    outcomes: { replicated: 22, partial: 32, failed: 18, discussion: 10 },
    tags: ['microbiome', 'gut-brain-axis', 'depression', '16S-sequencing',
           'mouse-model', 'germ-free', 'FMT', 'strain-variability'],
    contributors: [
      { name: 'Dr. L. Vasquez', role: 'Neurogastroenterologist, Karolinska', posts: 9, av: 'avt', letter: 'L' },
      { name: 'Björn Holm',     role: 'PhD, Uppsala Univ.',                  posts: 4, av: 'avn', letter: 'B' },
    ],
    posts: [
      {
        id: 1, author: 'Dr. L. Vasquez', affil: 'Karolinska Institutet', av: 'avt', letter: 'L',
        outcome: 'partial', date: 'Sep 3, 2024', ts: 1725321600,
        html: `FMT depression-transfer experiments in germ-free mice partially replicate, but <strong>strain matters enormously</strong>. C57BL/6J vs. BALB/c gives completely different anxiety phenotypes. Strain is unspecified in the review — major reproducibility gap.`,
        votes: 56,
        replies: [
          { author: 'Björn Holm', date: '3d later', body: 'Switching to BALB/c with littermate controls finally gave consistent results. Vendor also matters — Taconic vs Jackson mice have different baseline microbiomes.' }
        ],
      },
    ],
  },
};

/* ── Normalise a DOI string for lookup ── */
function normaliseDOI(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
}

/* ── Look up a paper: demo cache first, then CrossRef ── */
async function getPaper(rawDoi) {
  const doi = normaliseDOI(rawDoi);
  console.log('[getPaper] looking up:', doi);

  // 1. Check demo data
  for (const key of Object.keys(DEMO_PAPERS)) {
    if (doi === key || doi.includes(key) || key.includes(doi)) {
      console.log('[getPaper] found in demo data:', key);
      return DEMO_PAPERS[key];
    }
  }

  console.log('[getPaper] not in demo data, trying CrossRef…');

  // 2. Try CrossRef API
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!res.ok) throw new Error('CrossRef returned ' + res.status);
    const json = await res.json();
    const msg  = json.message;

    const authors = (msg.author || [])
      .map(a => (a.family || '') + (a.given ? ', ' + a.given[0] + '.' : ''))
      .join('; ') || 'Authors unknown';

    const journal = (msg['container-title'] || [])[0]
      || (msg.institution || [{ name: '' }])[0].name
      || 'Unknown Journal';

    const year = (msg.published?.['date-parts']?.[0]?.[0]) || '';

    console.log('[getPaper] CrossRef success:', msg.title?.[0]);

    return {
      journal:    `${journal}${year ? ' · ' + year : ''}`,
      title:      msg.title?.[0] || doi,
      authors,
      doi:        msg.DOI || rawDoi,
      repScore:   0,
      badgeClass: 'bm', badgeText: 'No Data Yet',
      outcomes:   { replicated: 0, partial: 0, failed: 0, discussion: 0 },
      tags: [], contributors: [], posts: [],
      _new: true,
    };
  } catch (err) {
    console.warn('[getPaper] CrossRef failed:', err.message);
    showToast('Could not fetch paper details. Check your connection.');
    return {
      journal:    'Unknown Journal',
      title:      'Paper: ' + rawDoi,
      authors:    '',
      doi:        rawDoi,
      repScore:   0,
      badgeClass: 'bm', badgeText: 'No Data Yet',
      outcomes:   { replicated: 0, partial: 0, failed: 0, discussion: 0 },
      tags: [], contributors: [], posts: [],
      _new: true,
    };
  }
}

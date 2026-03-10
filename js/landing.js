/* ============================================================
   landing.js — Home page: DOI search, recent chips, threads panel
   Depends on: supabase.js, ui.js, papers.js
   ============================================================ */

/* ── State ── */
let allThreads    = [];   // full list fetched from Supabase
let filteredThreads = []; // after search filter
let threadSort    = 'recent';

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Enter key on DOI input
  const input = document.getElementById('doi-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') searchDOI(); });

  // Load live data
  loadRecentChips();
  loadStats();
});

/* ════════════════════════════════════════════
   DOI SEARCH
   ════════════════════════════════════════════ */
function searchDOI() {
  const raw = document.getElementById('doi-input').value.trim();
  if (!raw) { showToast('Please enter a DOI.'); return; }
  goToThread(raw);
}

function goToThread(doi) {
  window.location.href = 'thread.html?doi=' + encodeURIComponent(doi);
}

/* ════════════════════════════════════════════
   LIVE STATS
   ════════════════════════════════════════════ */
async function loadStats() {
  try {
    const { data, error } = await sb.rpc('get_platform_stats');
    if (error) throw error;

    const papersEl      = document.getElementById('stat-papers');
    const researchersEl = document.getElementById('stat-researchers');

    if (papersEl)      papersEl.textContent      = formatCount(data.papers);
    if (researchersEl) researchersEl.textContent  = formatCount(data.researchers);
  } catch (err) {
    console.warn('[loadStats] error:', err.message);
    // Leave as — if it fails
  }
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
}

/* ════════════════════════════════════════════
   RECENTLY COMMENTED CHIPS
   Live from Supabase — falls back to demo papers
   ════════════════════════════════════════════ */
async function loadRecentChips() {
  const container = document.getElementById('recent-chips');
  if (!container) return;

  try {
    // Get the 3 papers with the most recent post activity
    const { data, error } = await sb
      .from('posts')
      .select('doi, created_at, papers(title, authors, doi)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Deduplicate — keep only latest post per DOI
    const seen = new Set();
    const recent = [];
    for (const row of (data || [])) {
      if (!seen.has(row.doi) && row.papers) {
        seen.add(row.doi);
        recent.push(row);
        if (recent.length === 3) break;
      }
    }

    // If we have live data, show it
    if (recent.length > 0) {
      container.innerHTML = recent.map(row => {
        const p    = row.papers;
        const ago  = timeAgo(row.created_at);
        return `
          <button class="pchip" onclick="goToThread('${p.doi}')">
            <div class="cdot dg"></div>
            <div>
              <div class="ctitle">${p.title}</div>
              <div class="cmeta">${p.doi} · last post ${ago}</div>
            </div>
          </button>`;
      }).join('');
      return;
    }
  } catch (err) {
    console.warn('[recentChips] Supabase error, falling back to demo:', err.message);
  }

  // Fallback — show demo papers
  container.innerHTML = `
    <button class="pchip" onclick="goToThread('10.48550/arXiv.1706.03762')">
      <div class="cdot dg"></div>
      <div>
        <div class="ctitle">Attention Is All You Need — Vaswani et al., 2017</div>
        <div class="cmeta">10.48550/arXiv.1706.03762 · Demo thread</div>
      </div>
    </button>
    <button class="pchip" onclick="goToThread('10.1177/0956797610383437')">
      <div class="cdot dr"></div>
      <div>
        <div class="ctitle">Power posing affects testosterone — Carney et al., 2010</div>
        <div class="cmeta">10.1177/0956797610383437 · Demo thread</div>
      </div>
    </button>
    <button class="pchip" onclick="goToThread('10.1038/s41579-019-0222-3')">
      <div class="cdot da"></div>
      <div>
        <div class="ctitle">Microbiome composition & depression — Cryan et al., 2019</div>
        <div class="cmeta">10.1038/s41579-019-0222-3 · Demo thread</div>
      </div>
    </button>`;
}

/* ════════════════════════════════════════════
   THREADS PANEL
   ════════════════════════════════════════════ */
async function openThreadsPanel() {
  document.getElementById('threads-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  await loadAllThreads();
}

function closeThreadsPanel(event) {
  // Close if clicking overlay background or close button
  if (event && event.target !== document.getElementById('threads-overlay')) return;
  _closeThreadsPanel();
}

function _closeThreadsPanel() {
  document.getElementById('threads-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Also close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') _closeThreadsPanel();
});

async function loadAllThreads() {
  const list = document.getElementById('threads-list');
  list.innerHTML = '<div class="chips-loading">Loading threads…</div>';

  try {
    // Get all papers that have posts, with post count and latest post date
    const { data, error } = await sb
      .from('posts')
      .select('doi, created_at, papers(doi, title, authors, journal, rep_score)');

    if (error) throw error;

    // Aggregate by DOI
    const map = {};
    for (const row of (data || [])) {
      if (!row.papers) continue;
      const doi = row.doi;
      if (!map[doi]) {
        map[doi] = {
          ...row.papers,
          postCount:  0,
          lastPost:   row.created_at,
        };
      }
      map[doi].postCount++;
      if (row.created_at > map[doi].lastPost) map[doi].lastPost = row.created_at;
    }

    allThreads = Object.values(map);

    // If empty, show demo papers as placeholder
    if (allThreads.length === 0) {
      allThreads = DEMO_PAPERS_LIST;
    }

    filteredThreads = [...allThreads];
    sortAndRenderThreads();

  } catch (err) {
    console.warn('[loadThreads] error:', err.message);
    allThreads     = DEMO_PAPERS_LIST;
    filteredThreads = [...allThreads];
    sortAndRenderThreads();
  }
}

/* Demo fallback list for threads panel */
const DEMO_PAPERS_LIST = [
  { doi: '10.48550/arXiv.1706.03762', title: 'Attention Is All You Need',
    authors: 'Vaswani et al.', journal: 'arXiv · 2017',
    rep_score: 89, postCount: 3, lastPost: '2025-03-18T00:00:00Z' },
  { doi: '10.1177/0956797610383437', title: 'Power Posing: Brief Nonverbal Displays Affect Neuroendocrine Levels',
    authors: 'Carney, Cuddy & Yap', journal: 'Psychological Science · 2010',
    rep_score: 12, postCount: 2, lastPost: '2024-02-20T00:00:00Z' },
  { doi: '10.1038/s41579-019-0222-3', title: 'The Microbiota–Gut–Brain Axis',
    authors: "Cryan et al.", journal: 'Nature Reviews Microbiology · 2019',
    rep_score: 54, postCount: 1, lastPost: '2024-09-03T00:00:00Z' },
];

/* ── Sort ── */
function setThreadSort(btn, val) {
  document.querySelectorAll('.threads-sort-row .sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  threadSort = val;
  sortAndRenderThreads();
}

function sortAndRenderThreads() {
  const sorted = [...filteredThreads].sort((a, b) => {
    if (threadSort === 'recent') return new Date(b.lastPost) - new Date(a.lastPost);
    if (threadSort === 'posts')  return (b.postCount || 0) - (a.postCount || 0);
    if (threadSort === 'rep')    return (b.rep_score || 0) - (a.rep_score || 0);
    return 0;
  });
  renderThreadList(sorted);
}

/* ── Search filter ── */
function filterThreads() {
  const q = document.getElementById('threads-search').value.trim().toLowerCase();
  filteredThreads = q
    ? allThreads.filter(t =>
        t.title?.toLowerCase().includes(q)  ||
        t.doi?.toLowerCase().includes(q)    ||
        t.authors?.toLowerCase().includes(q)
      )
    : [...allThreads];
  sortAndRenderThreads();
}

/* ── Render list ── */
function renderThreadList(threads) {
  const list = document.getElementById('threads-list');

  if (!threads.length) {
    list.innerHTML = `
      <div class="threads-empty">
        <div style="font-size:2rem;margin-bottom:0.6rem;">🔍</div>
        <div style="font-weight:600;color:var(--navy);margin-bottom:0.3rem;">No threads found</div>
        <div style="font-size:0.83rem;color:var(--muted);">Try a different search term</div>
      </div>`;
    return;
  }

  list.innerHTML = threads.map(t => {
    const repColor = t.rep_score >= 70 ? 'var(--teal)'
                   : t.rep_score >= 40 ? 'var(--amber)'
                   : t.rep_score > 0   ? 'var(--red)'
                   : 'var(--muted)';
    const ago = t.lastPost ? timeAgo(t.lastPost) : 'No posts yet';

    return `
      <div class="thread-row" onclick="goToThread('${t.doi}')">
        <div class="thread-row-main">
          <div class="thread-row-title">${t.title}</div>
          <div class="thread-row-authors">${t.authors || ''}</div>
          <div class="thread-row-meta">
            <span class="thread-row-journal">${t.journal || ''}</span>
            <span class="thread-row-doi">${t.doi}</span>
          </div>
        </div>
        <div class="thread-row-stats">
          <div class="thread-stat">
            <span class="thread-stat-n">${t.postCount || 0}</span>
            <span class="thread-stat-l">posts</span>
          </div>
          <div class="thread-stat">
            <span class="thread-stat-n" style="color:${repColor}">${t.rep_score || '—'}${t.rep_score ? '%' : ''}</span>
            <span class="thread-stat-l">rep. score</span>
          </div>
          <div class="thread-stat">
            <span class="thread-stat-n" style="font-size:0.72rem">${ago}</span>
            <span class="thread-stat-l">last post</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return mins  + 'm ago';
  if (hours < 24)  return hours + 'h ago';
  if (days  < 30)  return days  + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

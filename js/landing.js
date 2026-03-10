/* ============================================================
   landing.js — DOI search and navigation on the home page
   Depends on: ui.js, papers.js
   ============================================================ */

/* ── DOI search ── */
function searchDOI() {
  const raw = document.getElementById('doi-input').value.trim();
  if (!raw) { showToast('Please enter a DOI.'); return; }
  goToThread(raw);
}

/* ── Quick-link chips ── */
function loadDemo()  { goToThread('10.48550/arXiv.1706.03762'); }
function loadDemoB() { goToThread('10.1177/0956797610383437'); }
function loadDemoC() { goToThread('10.1038/s41579-019-0222-3'); }

/* ── Navigate to thread page with DOI in URL ── */
function goToThread(doi) {
  window.location.href = 'thread.html?doi=' + encodeURIComponent(doi);
}

/* ── Allow Enter key in DOI input ── */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('doi-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') searchDOI();
    });
  }
});

/* ============================================================
   ui.js — Shared UI helpers used on every page
   Exposes: showToast(), initNav()
   ============================================================ */

/* ── Toast notification ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Nav brand click → home ── */
function initNav() {
  const brand = document.querySelector('.nav-brand');
  if (brand) {
    brand.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', initNav);

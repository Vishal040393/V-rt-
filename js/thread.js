/* ============================================================
   thread.js — Paper discussion thread page
   Depends on: supabase.js, auth.js, papers.js, ui.js
   ============================================================ */

let currentPaper  = null;
let activeFilter  = 'all';
let activeSort    = 'top';
let mySavedPosts  = new Set();  // post IDs saved by current user

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const doi    = params.get('doi');
  if (!doi) { window.location.href = 'index.html'; return; }

  showToast('Loading paper…');
  const paper   = await getPaper(doi);
  currentPaper  = paper;

  // Load live rep score from DB (overrides demo static score)
  await loadRepScore(doi);

  renderPaperHeader(paper);
  await loadTags(doi);
  await loadAndRenderPosts();
  triggerKatex();
});

/* ════════════════════════════════════════════
   REPLICATION SCORE — live from posts table
   ════════════════════════════════════════════ */
async function loadRepScore(doi) {
  try {
    // Count outcomes directly from posts
    const { data, error } = await sb
      .from('posts')
      .select('outcome')
      .eq('doi', doi)
      .in('outcome', ['replicated', 'partial', 'failed']);

    if (error) throw error;

    const counts = { replicated: 0, partial: 0, failed: 0, discussion: 0 };
    (data || []).forEach(p => { if (counts[p.outcome] !== undefined) counts[p.outcome]++; });

    const total    = counts.replicated + counts.partial + counts.failed;
    const weighted = counts.replicated * 100 + counts.partial * 50;
    const score    = total > 0 ? Math.round(weighted / total) : null;

    // Also get discussion count
    const { count: discCount } = await sb
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('doi', doi)
      .eq('outcome', 'discussion');

    counts.discussion = discCount || 0;

    const badgeClass = score === null ? 'bm'
                     : score >= 70   ? 'bh'
                     : score >= 40   ? 'bm' : 'bl';
    const badgeText  = score === null ? 'No Replication Data'
                     : score >= 70   ? 'High Replicability'
                     : score >= 40   ? 'Moderate Replicability' : 'Low Replicability';

    currentPaper.repScore   = score ?? 0;
    currentPaper.badgeClass = badgeClass;
    currentPaper.badgeText  = badgeText;
    currentPaper.outcomes   = counts;

  } catch (err) {
    console.warn('[repScore] using static value:', err.message);
  }
}

/* ════════════════════════════════════════════
   PAPER HEADER
   ════════════════════════════════════════════ */
function renderPaperHeader(p) {
  document.title = p.title + ' — Vārtā';
  document.getElementById('pj').textContent       = p.journal;
  document.getElementById('pt').textContent       = p.title;
  document.getElementById('pa').textContent       = p.authors;
  document.getElementById('pd').textContent       = 'DOI: ' + p.doi;
  document.getElementById('doi-copy-txt').textContent = p.doi;
  document.getElementById('doi-link').href        = 'https://doi.org/' + p.doi;

  setTimeout(() => {
    document.getElementById('mf').style.width = p.repScore + '%';
    document.getElementById('mp').textContent = p.repScore + '%';
  }, 200);

  const rb = document.getElementById('rb');
  rb.className   = 'rbadge ' + p.badgeClass;
  rb.textContent = p.badgeText;

  renderSidebarChart(p.outcomes);
  renderContribs(p.contributors);
}

/* ════════════════════════════════════════════
   TAGS — load, render, add, remove
   ════════════════════════════════════════════ */
async function loadTags(doi) {
  try {
    const { data, error } = await sb
      .from('tags')
      .select('id, tag, user_id')
      .eq('doi', doi)
      .order('created_at', { ascending: true });

    if (error) throw error;
    renderTags(data || []);
  } catch (err) {
    console.warn('[loadTags] error:', err.message);
    // Fall back to static demo tags
    renderTags((currentPaper.tags || []).map(t => ({ tag: t, user_id: null })));
  }
}

function renderTags(tags) {
  const cloud = document.getElementById('tag-cloud');
  if (!cloud) return;

  const tagItems = tags.map(t => {
    const isOwn = currentUser && t.user_id === currentUser.id;
    return `
      <span class="tag-pill">
        #${t.tag}
        ${isOwn ? `<button class="tag-remove" onclick="removeTag('${t.tag}')" title="Remove tag">×</button>` : ''}
      </span>`;
  }).join('');

  const addBtn = `
    <button class="tag-add-btn" onclick="promptAddTag()" title="Add a tag">+ tag</button>`;

  cloud.innerHTML = tagItems + (currentUser ? addBtn : '');
}

async function promptAddTag() {
  if (!currentUser) { openAuth('login'); return; }
  const tag = prompt('Enter a tag (e.g. "pytorch", "sample-size", "NLP"):');
  if (!tag) return;
  const clean = tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!clean) { showToast('Invalid tag.'); return; }

  const { error } = await sb.from('tags').insert({
    doi:     currentPaper.doi,
    tag:     clean,
    user_id: currentUser.id,
  });

  if (error) {
    if (error.code === '23505') showToast('Tag already exists.');
    else showToast('Error adding tag: ' + error.message);
    return;
  }
  showToast('#' + clean + ' added!');
  await loadTags(currentPaper.doi);
}

async function removeTag(tag) {
  if (!currentUser) return;
  const { error } = await sb
    .from('tags')
    .delete()
    .eq('doi', currentPaper.doi)
    .eq('tag', tag)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Error removing tag.'); return; }
  showToast('Tag removed.');
  await loadTags(currentPaper.doi);
}

/* ════════════════════════════════════════════
   LOAD POSTS FROM SUPABASE
   ════════════════════════════════════════════ */
async function loadAndRenderPosts() {
  document.getElementById('thread-posts').innerHTML =
    `<div class="empty-thread"><div class="empty-icon">⏳</div><div class="empty-title">Loading discussions…</div></div>`;

  const { data: posts, error } = await sb
    .from('posts')
    .select(`
      id, doi, user_id, author, affil, outcome,
      html, vote_count, created_at,
      replies ( id, post_id, author, body, created_at )
    `)
    .eq('doi', currentPaper.doi)
    .order('created_at', { ascending: false });

  if (error) { console.error('[loadPosts]', error); showToast('Error loading posts.'); return; }

  // Fetch current user's votes and saved posts
  let myVotes = {};
  if (currentUser) {
    const [{ data: votes }, { data: saved }] = await Promise.all([
      sb.from('votes').select('post_id, direction').eq('user_id', currentUser.id),
      sb.from('saved_posts').select('post_id').eq('user_id', currentUser.id),
    ]);
    if (votes) votes.forEach(v => { myVotes[v.post_id] = v.direction; });
    if (saved) mySavedPosts = new Set(saved.map(s => s.post_id));
  }

  // Merge demo posts with live posts
  const demoPosts = currentPaper.posts || [];
  const allPosts  = [...demoPosts, ...(posts || [])].map(p => ({
    ...p,
    votes:   p.vote_count ?? p.votes ?? 0,
    myVote:  myVotes[p.id] || null,
    saved:   mySavedPosts.has(p.id),
    replies: p.replies || [],
    ts:      p.created_at ? new Date(p.created_at).getTime() : (p.ts || 0),
    date:    p.created_at
      ? new Date(p.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      : p.date,
  }));

  renderPosts(allPosts);

  // Update live rep score after posts load
  await loadRepScore(currentPaper.doi);
  document.getElementById('mf').style.width = currentPaper.repScore + '%';
  document.getElementById('mp').textContent = currentPaper.repScore + '%';
  const rb = document.getElementById('rb');
  rb.className = 'rbadge ' + currentPaper.badgeClass;
  rb.textContent = currentPaper.badgeText;
  renderSidebarChart(currentPaper.outcomes);
}

/* ════════════════════════════════════════════
   RENDER POSTS
   ════════════════════════════════════════════ */
function renderPosts(allPosts) {
  const filtered = activeFilter === 'all'
    ? allPosts
    : allPosts.filter(p => p.outcome === activeFilter);

  const sorted = [...filtered].sort((a, b) =>
    activeSort === 'top' ? b.votes - a.votes : b.ts - a.ts
  );

  document.getElementById('thread-label').textContent =
    `Discussion Thread (${allPosts.length} post${allPosts.length !== 1 ? 's' : ''})`;

  if (!sorted.length) {
    const msg = activeFilter !== 'all'
      ? `No ${activeFilter} posts yet.`
      : 'No posts yet. Be the first to share your experience!';
    document.getElementById('thread-posts').innerHTML = `
      <div class="empty-thread">
        <div class="empty-icon">📄</div>
        <div class="empty-title">No discussions yet</div>
        <div class="empty-desc">${msg}</div>
      </div>`;
    return;
  }

  document.getElementById('thread-posts').innerHTML = sorted.map(postHTML).join('');
  triggerKatex();
}

function postHTML(post) {
  const tagMap = {
    replicated:   ['tr', 'Replicated'],
    partial:      ['tp', 'Partial'],
    failed:       ['tf', 'Failed'],
    discussion:   ['td', 'Discussion'],
    methodology:  ['tm', 'Methodology'],
  };
  const [tc, tl]   = tagMap[post.outcome] || ['td', 'Discussion'];
  const score      = post.votes ?? 0;
  const scoreClass = score > 0 ? 'pos' : score < 0 ? 'neg' : '';
  const upActive   = post.myVote === 'up'   ? 'up-active'   : '';
  const dnActive   = post.myVote === 'down' ? 'down-active' : '';
  const savedClass = post.saved ? 'saved-active' : '';

  const repliesHTML = (post.replies || [])
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map(r => `
      <div class="reply">
        <div class="reply-hdr">
          <span class="reply-author">${r.author}</span>
          <span class="reply-date">— ${r.created_at
            ? new Date(r.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })
            : r.date || ''}</span>
        </div>
        <div class="reply-body">${r.body}</div>
      </div>`).join('');

  return `
    <div class="post" id="post-${post.id}">
      <div class="post-hdr">
        <div class="pa-row">
          <div class="avatar ${post.av || 'avn'}">${post.letter || post.author?.[0]?.toUpperCase() || '?'}</div>
          <div>
            <div class="author-name">
              ${post.author}
              ${post.verified ? '<span class="vbadge">Author</span>' : ''}
            </div>
            <div class="author-affil">${post.affil || ''}</div>
          </div>
        </div>
        <div class="post-meta-r">
          <span class="otag ${tc}">${tl}</span>
          <span class="pdate">${post.date || ''}</span>
        </div>
      </div>

      <div class="post-body">${post.html}</div>

      <div class="post-footer">
        <div class="vote-wrap">
          <button class="vote-btn ${upActive}" id="up-${post.id}"
            onclick="vote(${post.id},'up')">▲ Helpful</button>
          <span class="vote-score ${scoreClass}" id="score-${post.id}">${score}</span>
          <button class="vote-btn ${dnActive}" id="dn-${post.id}"
            onclick="vote(${post.id},'down')">▼</button>
        </div>
        <button class="action-btn" onclick="toggleReply(${post.id})">💬 Reply</button>
        <button class="action-btn ${savedClass}" id="save-btn-${post.id}"
          onclick="toggleSave(${post.id})">
          ${post.saved ? '🔖 Saved' : '🔖 Save'}
        </button>
        <button class="action-btn" onclick="sharePost(${post.id})">⎘ Share</button>
      </div>

      ${repliesHTML ? `<div class="post-replies">${repliesHTML}</div>` : ''}

      <div class="reply-form" id="rf-${post.id}">
        <textarea class="reply-input" id="ri-${post.id}" placeholder="Write a reply…"></textarea>
        <div class="reply-submit-row">
          <button class="btn-sm btn-sm-ghost" onclick="toggleReply(${post.id})">Cancel</button>
          <button class="btn-sm btn-sm-fill" onclick="submitReply(${post.id})">Post Reply</button>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   SAVE / UNSAVE POST
   ════════════════════════════════════════════ */
async function toggleSave(postId) {
  if (!currentUser) { openAuth('login'); showToast('Sign in to save posts.'); return; }

  const btn     = document.getElementById('save-btn-' + postId);
  const isSaved = mySavedPosts.has(postId);

  if (isSaved) {
    const { error } = await sb.from('saved_posts')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('post_id', postId);
    if (error) { showToast('Error removing save.'); return; }
    mySavedPosts.delete(postId);
    if (btn) { btn.textContent = '🔖 Save'; btn.classList.remove('saved-active'); }
    showToast('Post removed from saved.');
  } else {
    const { error } = await sb.from('saved_posts').insert({
      user_id: currentUser.id,
      post_id: postId,
    });
    if (error) { showToast('Error saving post.'); return; }
    mySavedPosts.add(postId);
    if (btn) { btn.textContent = '🔖 Saved'; btn.classList.add('saved-active'); }
    showToast('Post saved!');
  }
}

/* ════════════════════════════════════════════
   SUBMIT POST
   ════════════════════════════════════════════ */
async function submitPost() {
  if (!currentUser) { openAuth('login'); return; }
  const html    = document.getElementById('editor').innerHTML.trim();
  if (!html || html === '<br>') { showToast('Please write something before posting.'); return; }
  const outcome = document.getElementById('post-outcome').value;

  // Upsert paper row
  await sb.from('papers').upsert({
    doi:     currentPaper.doi,
    title:   currentPaper.title,
    authors: currentPaper.authors,
    journal: currentPaper.journal,
  }, { onConflict: 'doi' });

  const { error } = await sb.from('posts').insert({
    doi:     currentPaper.doi,
    user_id: currentUser.id,
    author:  currentUser.name,
    affil:   currentUser.role + (currentUser.inst ? ', ' + currentUser.inst : ''),
    outcome,
    html,
  });

  if (error) { showToast('Error posting: ' + error.message); return; }

  document.getElementById('editor').innerHTML = '';
  updateCharCount();
  showToast('Post saved!');
  await loadAndRenderPosts();

  setTimeout(() => {
    const posts = document.querySelectorAll('.post');
    if (posts.length) posts[posts.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ════════════════════════════════════════════
   VOTING
   ════════════════════════════════════════════ */
async function vote(postId, dir) {
  if (!currentUser) { openAuth('login'); showToast('Sign in to vote.'); return; }

  const upBtn    = document.getElementById('up-' + postId);
  const dnBtn    = document.getElementById('dn-' + postId);
  const scoreEl  = document.getElementById('score-' + postId);
  const alreadyUp   = upBtn?.classList.contains('up-active');
  const alreadyDown = dnBtn?.classList.contains('down-active');

  if ((dir === 'up' && alreadyUp) || (dir === 'down' && alreadyDown)) {
    await sb.from('votes').delete()
      .eq('user_id', currentUser.id).eq('post_id', postId);
  } else {
    await sb.from('votes').upsert({
      user_id: currentUser.id, post_id: postId, direction: dir,
    }, { onConflict: 'user_id,post_id' });
  }

  const { data } = await sb.from('posts').select('vote_count').eq('id', postId).single();
  if (data && scoreEl) {
    const score = data.vote_count;
    scoreEl.textContent = score;
    scoreEl.className   = 'vote-score' + (score > 0 ? ' pos' : score < 0 ? ' neg' : '');
  }

  const isNowUp   = dir === 'up'   && !alreadyUp;
  const isNowDown = dir === 'down' && !alreadyDown;
  upBtn?.classList.toggle('up-active',   isNowUp);
  dnBtn?.classList.toggle('down-active', isNowDown);
}

/* ════════════════════════════════════════════
   REPLIES
   ════════════════════════════════════════════ */
function toggleReply(id) {
  if (!currentUser) { openAuth('login'); return; }
  const rf = document.getElementById('rf-' + id);
  rf.classList.toggle('open');
  if (rf.classList.contains('open')) document.getElementById('ri-' + id).focus();
}

async function submitReply(postId) {
  if (!currentUser) { openAuth('login'); return; }
  const body = document.getElementById('ri-' + postId).value.trim();
  if (!body) { showToast('Please write a reply.'); return; }

  const { error } = await sb.from('replies').insert({
    post_id: postId, user_id: currentUser.id,
    author: currentUser.name, body,
  });

  if (error) { showToast('Error posting reply: ' + error.message); return; }
  document.getElementById('ri-' + postId).value = '';
  document.getElementById('rf-' + postId).classList.remove('open');
  showToast('Reply posted!');
  await loadAndRenderPosts();
}

/* ════════════════════════════════════════════
   SIDEBAR
   ════════════════════════════════════════════ */
function renderSidebarChart(o) {
  if (!o) return;
  const total = Math.max(1, o.replicated + o.partial + o.failed + (o.discussion || 0));
  const rows = [
    { l: 'Replicated', pct: Math.round(o.replicated / total * 100), cls: 'bt' },
    { l: 'Partial',    pct: Math.round(o.partial    / total * 100), cls: 'ba' },
    { l: 'Failed',     pct: Math.round(o.failed     / total * 100), cls: 'br' },
    { l: 'Discussion', pct: Math.round((o.discussion||0) / total * 100), cls: 'bn' },
  ];
  document.getElementById('outcome-chart').innerHTML = rows.map(r => `
    <div class="crow">
      <span class="clabel">${r.l}</span>
      <div class="cbar-w"><div class="cbar-i ${r.cls}" style="width:${r.pct}%"></div></div>
      <span class="cpct">${r.pct}%</span>
    </div>`).join('');
}

function renderContribs(cs) {
  document.getElementById('contribs').innerHTML = cs && cs.length
    ? cs.map(c => `
        <div class="contrib-r">
          <div class="avatar ${c.av}">${c.letter}</div>
          <div class="cinfo">
            <div class="cname">${c.name}${c.verified ? '<span class="vbadge" style="margin-left:4px;">Author</span>' : ''}</div>
            <div class="crole">${c.role}</div>
          </div>
          <div class="cposts">${c.posts} posts</div>
        </div>`).join('')
    : '<span style="font-size:0.8rem;color:var(--muted);font-style:italic;">No contributors yet</span>';
}

/* ════════════════════════════════════════════
   COMPOSE TOOLBAR
   ════════════════════════════════════════════ */
function setPostType(btn, type) {
  document.querySelectorAll('.ctab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('post-outcome').value = type;
  const hints = {
    replicated:  'Describe your replication attempt — setup, data, environment, and results.',
    partial:     'What worked and what didn\'t? Be specific about which parts reproduced.',
    failed:      'What obstacles did you hit? What was your setup and where did it break?',
    discussion:  'Ask a question or share broader thoughts on this paper.',
  };
  document.getElementById('editor').setAttribute('data-placeholder', hints[type]);
}

function fmt(cmd) { document.execCommand(cmd, false, null); document.getElementById('editor').focus(); }

function insertBlockquote() {
  const text = window.getSelection()?.toString() || '';
  document.execCommand('insertHTML', false, `<blockquote>${text || 'Quote here…'}</blockquote><br>`);
  document.getElementById('editor').focus();
}

function insertMath(type) {
  const sym = type === 'inline' ? '\\(E = mc^2\\)' : '\\[\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\\]';
  document.execCommand('insertText', false, sym);
  showToast(type === 'inline' ? 'Edit between \\( and \\)' : 'Edit between \\[ and \\]');
  document.getElementById('editor').focus();
}

function toggleImgRow() {
  const row = document.getElementById('img-url-row');
  row.classList.toggle('show');
  if (row.classList.contains('show')) document.getElementById('img-url-in').focus();
}

function insertImageURL() {
  const url = document.getElementById('img-url-in').value.trim();
  if (!url) { showToast('Please enter an image URL.'); return; }
  document.execCommand('insertHTML', false, `<img src="${url}" alt="figure">`);
  document.getElementById('img-url-in').value = '';
  toggleImgRow();
  document.getElementById('editor').focus();
}

function updateCharCount() {
  const len = document.getElementById('editor').innerText.length;
  document.getElementById('char-count').textContent = len + ' chars';
}

/* ════════════════════════════════════════════
   FILTER + SORT
   ════════════════════════════════════════════ */
function setFilter(btn, val) {
  document.querySelectorAll('.filt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = val;
  loadAndRenderPosts();
}

function setSort(btn, val) {
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeSort = val;
  loadAndRenderPosts();
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function sharePost(id) {
  const url = window.location.href.split('#')[0] + '#post-' + id;
  navigator.clipboard?.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast(url));
}

function copyDOI() {
  const doi = currentPaper?.doi || '';
  navigator.clipboard?.writeText(doi).then(() => showToast('DOI copied!')).catch(() => showToast(doi));
}

function triggerKatex() {
  if (!window.renderMathInElement) return;
  document.querySelectorAll('.post-body').forEach(el => {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '$',   right: '$',   display: false },
      ],
      throwOnError: false,
    });
  });
}

window.addEventListener('load', triggerKatex);

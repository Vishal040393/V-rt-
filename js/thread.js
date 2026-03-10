/* ============================================================
   thread.js — Paper discussion thread page
   Depends on: supabase.js, auth.js, papers.js, ui.js
   ============================================================ */

let currentPaper = null;
let activeFilter = 'all';
let activeSort   = 'top';

/* ════════════════════════════════════════════
   INIT — read DOI from URL, load paper + posts
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const doi    = params.get('doi');

  if (!doi) { window.location.href = 'index.html'; return; }

  showToast('Loading paper…');

  const paper = await getPaper(doi);
  currentPaper = paper;
  renderPaperHeader(paper);

  await loadAndRenderPosts();
  triggerKatex();
});

/* ════════════════════════════════════════════
   PAPER HEADER
   ════════════════════════════════════════════ */
function renderPaperHeader(p) {
  document.title = p.title + ' — Vārtā';
  document.getElementById('pj').textContent = p.journal;
  document.getElementById('pt').textContent = p.title;
  document.getElementById('pa').textContent = p.authors;
  document.getElementById('pd').textContent = 'DOI: ' + p.doi;
  document.getElementById('doi-copy-txt').textContent = p.doi;
  document.getElementById('doi-link').href = 'https://doi.org/' + p.doi;

  setTimeout(() => {
    document.getElementById('mf').style.width = p.repScore + '%';
    document.getElementById('mp').textContent = p.repScore + '%';
  }, 200);

  const rb = document.getElementById('rb');
  rb.className   = 'rbadge ' + p.badgeClass;
  rb.textContent = p.badgeText;

  renderSidebarChart(p.outcomes);
  renderTags(p.tags);
  renderContribs(p.contributors);
}

/* ════════════════════════════════════════════
   LOAD POSTS FROM SUPABASE
   ════════════════════════════════════════════ */
async function loadAndRenderPosts() {
  document.getElementById('thread-posts').innerHTML =
    `<div class="empty-thread"><div class="empty-icon">⏳</div><div class="empty-title">Loading discussions…</div></div>`;

  // Fetch posts for this DOI
  const { data: posts, error } = await sb
    .from('posts')
    .select(`
      id, doi, user_id, author, affil, outcome,
      html, vote_count, created_at,
      replies ( id, post_id, author, body, created_at )
    `)
    .eq('doi', currentPaper.doi)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[loadPosts] error:', error);
    showToast('Error loading posts: ' + error.message);
    return;
  }

  // Fetch current user's votes so we can highlight their votes
  let myVotes = {};
  if (currentUser) {
    const { data: votes } = await sb
      .from('votes')
      .select('post_id, direction')
      .eq('user_id', currentUser.id);
    if (votes) votes.forEach(v => { myVotes[v.post_id] = v.direction; });
  }

  // Merge with demo posts if this is a demo paper
  const demoPosts = currentPaper.posts || [];
  const allPosts  = [...demoPosts, ...(posts || [])].map(p => ({
    ...p,
    votes:     p.vote_count ?? p.votes ?? 0,
    myVote:    myVotes[p.id] || null,
    replies:   p.replies || [],
    ts:        p.created_at ? new Date(p.created_at).getTime() : (p.ts || 0),
    date:      p.created_at
      ? new Date(p.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      : p.date,
  }));

  renderPosts(allPosts);
  updateOutcomeChart(allPosts);
}

/* ════════════════════════════════════════════
   RENDER POSTS
   ════════════════════════════════════════════ */
function renderPosts(allPosts) {
  // Filter
  const filtered = activeFilter === 'all'
    ? allPosts
    : allPosts.filter(p => p.outcome === activeFilter);

  // Sort
  const sorted = [...filtered].sort((a, b) =>
    activeSort === 'top' ? b.votes - a.votes : b.ts - a.ts
  );

  document.getElementById('thread-label').textContent =
    `Discussion Thread (${allPosts.length} post${allPosts.length !== 1 ? 's' : ''})`;

  if (!sorted.length) {
    const msg = activeFilter !== 'all'
      ? `No ${activeFilter} posts yet.`
      : 'No posts yet. Be the first to share your experience with this paper!';
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
    replicated:  ['tr', 'Replicated'],
    partial:     ['tp', 'Partial'],
    failed:      ['tf', 'Failed'],
    discussion:  ['td', 'Discussion'],
    methodology: ['tm', 'Methodology'],
  };
  const [tc, tl]  = tagMap[post.outcome] || ['td', 'Discussion'];
  const score     = post.votes ?? 0;
  const scoreClass = score > 0 ? 'pos' : score < 0 ? 'neg' : '';
  const upActive  = post.myVote === 'up'   ? 'up-active'   : '';
  const dnActive  = post.myVote === 'down' ? 'down-active' : '';

  const repliesHTML = (post.replies || [])
    .sort((a,b) => new Date(a.created_at||0) - new Date(b.created_at||0))
    .map(r => `
      <div class="reply">
        <div class="reply-hdr">
          <span class="reply-author">${r.author}</span>
          <span class="reply-date">— ${r.created_at
            ? new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})
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
        <button class="action-btn" onclick="sharePost(${post.id})">⎘ Share</button>
      </div>

      ${repliesHTML ? `<div class="post-replies">${repliesHTML}</div>` : ''}

      <div class="reply-form" id="rf-${post.id}">
        <textarea class="reply-input" id="ri-${post.id}"
          placeholder="Write a reply…"></textarea>
        <div class="reply-submit-row">
          <button class="btn-sm btn-sm-ghost" onclick="toggleReply(${post.id})">Cancel</button>
          <button class="btn-sm btn-sm-fill" onclick="submitReply(${post.id})">Post Reply</button>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   SUBMIT POST — saves to Supabase
   ════════════════════════════════════════════ */
async function submitPost() {
  if (!currentUser) { openAuth('login'); return; }

  const html    = document.getElementById('editor').innerHTML.trim();
  if (!html || html === '<br>') { showToast('Please write something before posting.'); return; }

  const outcome = document.getElementById('post-outcome').value;

  // Make sure paper row exists in DB first
  await sb.from('papers').upsert({
    doi:     currentPaper.doi,
    title:   currentPaper.title,
    authors: currentPaper.authors,
    journal: currentPaper.journal,
  }, { onConflict: 'doi' });

  // Insert post
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
   VOTING — saves to Supabase
   ════════════════════════════════════════════ */
async function vote(postId, dir) {
  if (!currentUser) { openAuth('login'); showToast('Sign in to vote.'); return; }

  // Get current vote state from button classes
  const upBtn  = document.getElementById('up-' + postId);
  const dnBtn  = document.getElementById('dn-' + postId);
  const scoreEl = document.getElementById('score-' + postId);
  const alreadyUp   = upBtn?.classList.contains('up-active');
  const alreadyDown = dnBtn?.classList.contains('down-active');

  if ((dir === 'up' && alreadyUp) || (dir === 'down' && alreadyDown)) {
    // Remove vote
    await sb.from('votes')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('post_id', postId);
  } else {
    // Upsert vote (insert or update)
    await sb.from('votes').upsert({
      user_id:   currentUser.id,
      post_id:   postId,
      direction: dir,
    }, { onConflict: 'user_id,post_id' });
  }

  // Refresh just this post's vote count from DB
  const { data } = await sb
    .from('posts')
    .select('vote_count')
    .eq('id', postId)
    .single();

  if (data && scoreEl) {
    const score = data.vote_count;
    scoreEl.textContent = score;
    scoreEl.className   = 'vote-score' + (score > 0 ? ' pos' : score < 0 ? ' neg' : '');
  }

  // Toggle button active states
  const isNowUp   = dir === 'up'   && !alreadyUp;
  const isNowDown = dir === 'down' && !alreadyDown;
  upBtn?.classList.toggle('up-active',   isNowUp);
  dnBtn?.classList.toggle('down-active', isNowDown);
}

/* ════════════════════════════════════════════
   REPLIES — saves to Supabase
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
    post_id: postId,
    user_id: currentUser.id,
    author:  currentUser.name,
    body,
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
  const total = Math.max(1, o.replicated + o.partial + o.failed + o.discussion);
  const rows = [
    { l: 'Replicated', pct: Math.round(o.replicated  / total * 100), cls: 'bt' },
    { l: 'Partial',    pct: Math.round(o.partial     / total * 100), cls: 'ba' },
    { l: 'Failed',     pct: Math.round(o.failed      / total * 100), cls: 'br' },
    { l: 'Discussion', pct: Math.round(o.discussion  / total * 100), cls: 'bn' },
  ];
  document.getElementById('outcome-chart').innerHTML = rows.map(r => `
    <div class="crow">
      <span class="clabel">${r.l}</span>
      <div class="cbar-w"><div class="cbar-i ${r.cls}" style="width:${r.pct}%"></div></div>
      <span class="cpct">${r.pct}%</span>
    </div>`).join('');
}

// Recalculate chart from live posts
function updateOutcomeChart(posts) {
  const o = { replicated: 0, partial: 0, failed: 0, discussion: 0 };
  posts.forEach(p => { if (o[p.outcome] !== undefined) o[p.outcome]++; });
  renderSidebarChart(o);
}

function renderTags(tags) {
  document.getElementById('tag-cloud').innerHTML = tags && tags.length
    ? tags.map(t => `<button class="tag-pill">#${t}</button>`).join('')
    : '<span style="font-size:0.8rem;color:var(--muted);font-style:italic;">No tags yet</span>';
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
  const sym = type === 'inline'
    ? '\\(E = mc^2\\)'
    : '\\[\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\\]';
  document.execCommand('insertText', false, sym);
  showToast(type === 'inline' ? 'Edit the expression between \\( and \\)' : 'Edit between \\[ and \\]');
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
  navigator.clipboard?.writeText(url)
    .then(()  => showToast('Link copied!'))
    .catch(() => showToast('Share: ' + url));
}

function copyDOI() {
  const doi = currentPaper?.doi || '';
  navigator.clipboard?.writeText(doi)
    .then(()  => showToast('DOI copied!'))
    .catch(() => showToast('DOI: ' + doi));
}

function triggerKatex() {
  if (!window.renderMathInElement) return;
  document.querySelectorAll('.post-body').forEach(el => {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true  },
        { left: '$',   right: '$',   display: false },
      ],
      throwOnError: false,
    });
  });
}

window.addEventListener('load', triggerKatex);

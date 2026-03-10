/* ============================================================
   auth.js — Sign up, login, logout, session state
   Exposes: currentUser, openAuth(), closeAuth(), logout()
   ============================================================ */

// In-memory user session (replace with Supabase auth later)
let currentUser = null;

/* ── Open / close modal ── */
function openAuth(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-modal').classList.add('open');
}

function closeAuth() {
  document.getElementById('auth-modal').classList.remove('open');
}

function closeModalOutside(event) {
  if (event.target === document.getElementById('auth-modal')) closeAuth();
}

/* ── Tab switcher ── */
function switchAuthTab(tab) {
  document.getElementById('login-form').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}

/* ── Login ── */
function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;

  if (!email || !pass) { showToast('Please fill in all fields.'); return; }

  // TODO: replace with real Supabase call:
  // const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })

  const displayName = email
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  currentUser = {
    name:   displayName,
    email,
    role:   'Researcher',
    inst:   email.split('@')[1] || 'Unknown',
    letter: displayName[0].toUpperCase(),
  };

  closeAuth();
  updateNavUser();
  showToast('Welcome back, ' + currentUser.name + '!');
}

/* ── Sign up ── */
function doSignup() {
  const fn   = document.getElementById('su-fname').value.trim();
  const ln   = document.getElementById('su-lname').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const role  = document.getElementById('su-role').value;
  const inst  = document.getElementById('su-inst').value.trim();
  const pass  = document.getElementById('su-pass').value;

  if (!fn || !ln || !email || !inst || !pass) {
    showToast('Please fill all required fields.'); return;
  }
  if (pass.length < 8) {
    showToast('Password must be at least 8 characters.'); return;
  }

  // TODO: replace with real Supabase call:
  // const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: fn+' '+ln, role, institution: inst } } })

  currentUser = { name: fn + ' ' + ln, email, role, inst, letter: fn[0].toUpperCase() };
  closeAuth();
  updateNavUser();
  showToast('Account created! Welcome, ' + fn + '.');
}

/* ── Logout ── */
function logout() {
  // TODO: await supabase.auth.signOut()
  currentUser = null;
  const nr = document.getElementById('nav-right');
  nr.innerHTML = `
    <button class="btn-nav" onclick="openAuth('login')">Sign In</button>
    <button class="btn-nav btn-nav-filled" onclick="openAuth('signup')">Join Free</button>
  `;
  showToast('Signed out.');
}

/* ── Update nav after login ── */
function updateNavUser() {
  const nr = document.getElementById('nav-right');
  nr.innerHTML = `
    <div class="profile-wrap">
      <div style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;" onclick="toggleProfileMenu()">
        <div class="nav-avatar">${currentUser.letter}</div>
        <span class="nav-username">${currentUser.name.split(' ')[0]}</span>
        <span style="color:rgba(255,255,255,0.35);font-size:0.7rem;">▾</span>
      </div>
      <div class="profile-menu" id="profile-menu">
        <div class="pm-item" style="font-weight:600;color:var(--navy);">
          <div class="avatar ava" style="width:28px;height:28px;font-size:0.72rem;">${currentUser.letter}</div>
          <div>
            <div style="font-weight:600;">${currentUser.name}</div>
            <div style="font-size:0.7rem;color:var(--muted);font-weight:400;">${currentUser.role}</div>
          </div>
        </div>
        <div class="pm-sep"></div>
        <button class="pm-item" onclick="showToast('Profile page coming soon!')">👤 My Profile</button>
        <button class="pm-item" onclick="showToast('My posts coming soon!')">📝 My Posts</button>
        <button class="pm-item" onclick="showToast('Saved threads coming soon!')">🔖 Saved Threads</button>
        <div class="pm-sep"></div>
        <button class="pm-item" onclick="logout()" style="color:var(--red);">↩ Sign Out</button>
      </div>
    </div>
  `;
}

function toggleProfileMenu() {
  document.getElementById('profile-menu').classList.toggle('open');
}

/* Close dropdown when clicking outside */
document.addEventListener('click', e => {
  const wrap = document.querySelector('.profile-wrap');
  const menu = document.getElementById('profile-menu');
  if (menu && wrap && !wrap.contains(e.target)) menu.classList.remove('open');
});
